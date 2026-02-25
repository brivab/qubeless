import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { SsoConfigService } from '../sso-config.service';
import { OidcConfig, OidcDiscoveryDocument, OidcProfile } from '../sso.types';
import { OidcUserMapper } from './oidc-user-mapper';
import { AuthService } from '../../auth/auth.service';
import { LoginResponse } from '@qubeless/shared';
import { SsoProvider } from '@prisma/client';

const STATE_TTL_MS = 10 * 60 * 1000;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

type OidcStateEntry = {
  createdAt: number;
  nonce: string;
  codeVerifier?: string;
};

type OidcTokens = {
  access_token?: string;
  id_token?: string;
};

@Injectable()
export class OidcService {
  private readonly stateStore = new Map<string, OidcStateEntry>();
  private discoveryCache: { fetchedAt: number; doc: OidcDiscoveryDocument } | null = null;

  constructor(
    private readonly ssoConfig: SsoConfigService,
    private readonly userMapper: OidcUserMapper,
    private readonly authService: AuthService,
  ) {}

  async buildLoginUrl(): Promise<string> {
    const config = this.ssoConfig.getOidcConfig();
    const discovery = await this.getDiscovery(config);

    const state = this.randomUrlSafe(16);
    const nonce = this.randomUrlSafe(16);
    const codeVerifier = config.usePkce ? this.randomUrlSafe(32) : undefined;

    this.storeState(state, { createdAt: Date.now(), nonce, codeVerifier });

    const authUrl = new URL(discovery.authorization_endpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('scope', config.scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);

    if (config.prompt) {
      authUrl.searchParams.set('prompt', config.prompt);
    }

    if (codeVerifier) {
      const challenge = this.toCodeChallenge(codeVerifier);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    return authUrl.toString();
  }

  async handleCallback(query: Record<string, string | string[] | undefined>): Promise<LoginResponse> {
    const error = this.first(query.error);
    if (error) {
      const description = this.first(query.error_description);
      throw new BadRequestException(description ? `${error}: ${description}` : error);
    }

    const code = this.first(query.code);
    const state = this.first(query.state);

    if (!code || !state) {
      throw new BadRequestException('OIDC callback missing code or state');
    }

    const stateEntry = this.consumeState(state);
    if (!stateEntry) {
      throw new UnauthorizedException('OIDC state invalid or expired');
    }

    const config = this.ssoConfig.getOidcConfig();
    const discovery = await this.getDiscovery(config);
    const tokens = await this.exchangeCode(config, discovery, code, stateEntry.codeVerifier);
    const profile = await this.buildProfile(config, discovery, tokens, stateEntry.nonce);

    const user = await this.userMapper.resolveUser(SsoProvider.OIDC, profile);
    return this.authService.loginWithUser(user);
  }

  private async exchangeCode(
    config: OidcConfig,
    discovery: OidcDiscoveryDocument,
    code: string,
    codeVerifier?: string,
  ): Promise<OidcTokens> {
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', config.redirectUri);
    params.set('client_id', config.clientId);

    if (codeVerifier) {
      params.set('code_verifier', codeVerifier);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (config.clientSecret) {
      if (config.tokenAuthMethod === 'client_secret_post') {
        params.set('client_secret', config.clientSecret);
      } else if (config.tokenAuthMethod === 'client_secret_basic') {
        const token = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
        headers.Authorization = `Basic ${token}`;
      }
    }

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers,
      body: params,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException(`OIDC token exchange failed (${response.status}): ${body}`);
    }

    return (await response.json()) as OidcTokens;
  }

  private async buildProfile(
    config: OidcConfig,
    discovery: OidcDiscoveryDocument,
    tokens: OidcTokens,
    expectedNonce: string,
  ): Promise<OidcProfile> {
    const claims = tokens.id_token
      ? await this.verifyIdToken(config, discovery, tokens.id_token)
      : null;

    if (claims?.nonce && claims.nonce !== expectedNonce) {
      throw new UnauthorizedException('OIDC nonce mismatch');
    }

    let profile: OidcProfile = {
      sub: claims?.sub as string | undefined,
      email: (claims?.email as string | undefined) ?? null,
    };

    if (!profile.email) {
      const fallbackEmail =
        (claims?.preferred_username as string | undefined) ??
        (claims?.upn as string | undefined) ??
        (claims?.unique_name as string | undefined);
      profile.email = fallbackEmail ?? null;
    }

    if ((!profile.email || !profile.sub) && discovery.userinfo_endpoint && tokens.access_token) {
      const userInfo = await this.fetchUserInfo(discovery.userinfo_endpoint, tokens.access_token);
      profile = {
        sub: profile.sub ?? (userInfo.sub as string | undefined),
        email: profile.email ?? (userInfo.email as string | undefined) ?? null,
      };
    }

    return profile;
  }

  private async fetchUserInfo(endpoint: string, accessToken: string) {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException(`OIDC userinfo failed (${response.status}): ${body}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  private async verifyIdToken(config: OidcConfig, discovery: OidcDiscoveryDocument, idToken: string) {
    if (config.skipTokenVerify) {
      return this.decodeJwtPayload(idToken);
    }

    if (!discovery.jwks_uri) {
      throw new BadRequestException('OIDC jwks_uri missing');
    }

    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));

    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: discovery.issuer ?? config.issuer,
      audience: config.clientId,
    });

    return payload as Record<string, unknown>;
  }

  private decodeJwtPayload(token: string) {
    const parts = token.split('.');
    if (parts.length < 2) {
      throw new BadRequestException('OIDC id_token malformed');
    }

    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload) as Record<string, unknown>;
  }

  private async getDiscovery(config: OidcConfig): Promise<OidcDiscoveryDocument> {
    if (this.discoveryCache && Date.now() - this.discoveryCache.fetchedAt < DISCOVERY_TTL_MS) {
      return this.discoveryCache.doc;
    }

    const issuer = config.issuer.replace(/\/$/, '');
    const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
    const response = await fetch(discoveryUrl);

    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException(`OIDC discovery failed (${response.status}): ${body}`);
    }

    const doc = (await response.json()) as OidcDiscoveryDocument;
    if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.issuer) {
      throw new BadRequestException('OIDC discovery document incomplete');
    }

    this.discoveryCache = { fetchedAt: Date.now(), doc };
    return doc;
  }

  private storeState(state: string, entry: OidcStateEntry) {
    this.cleanupStates();
    this.stateStore.set(state, entry);
  }

  private consumeState(state: string) {
    this.cleanupStates();
    const entry = this.stateStore.get(state);
    if (entry) {
      this.stateStore.delete(state);
    }
    return entry ?? null;
  }

  private cleanupStates() {
    const now = Date.now();
    for (const [key, entry] of this.stateStore.entries()) {
      if (now - entry.createdAt > STATE_TTL_MS) {
        this.stateStore.delete(key);
      }
    }
  }

  private randomUrlSafe(size: number) {
    return randomBytes(size).toString('base64url');
  }

  private toCodeChallenge(verifier: string) {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  private first(value: string | string[] | undefined): string | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}
