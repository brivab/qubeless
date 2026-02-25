import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OidcConfig, SamlConfig, SsoProviderInfo } from './sso.types';

function parseBool(value?: string): boolean {
  if (!value) return false;
  return value.toLowerCase() === 'true' || value === '1';
}

@Injectable()
export class SsoConfigService {
  constructor(private readonly configService: ConfigService) {}

  isOidcEnabled(): boolean {
    return parseBool(this.configService.get<string>('SSO_OIDC_ENABLED'));
  }

  isSamlEnabled(): boolean {
    return parseBool(this.configService.get<string>('SSO_SAML_ENABLED'));
  }

  getOidcConfig(): OidcConfig {
    const issuer = this.configService.get<string>('SSO_OIDC_ISSUER');
    const clientId = this.configService.get<string>('SSO_OIDC_CLIENT_ID');
    const clientSecret = this.configService.get<string>('SSO_OIDC_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('SSO_OIDC_REDIRECT_URL');
    const scopes = this.configService.get<string>('SSO_OIDC_SCOPES') ?? 'openid email profile';
    const prompt = this.configService.get<string>('SSO_OIDC_PROMPT');
    const usePkceRaw = this.configService.get<string>('SSO_OIDC_PKCE');
    const tokenAuthMethod =
      (this.configService.get<string>('SSO_OIDC_TOKEN_AUTH') as OidcConfig['tokenAuthMethod']) ??
      'client_secret_post';
    const skipTokenVerify = parseBool(this.configService.get<string>('SSO_OIDC_SKIP_TOKEN_VERIFY'));
    const logoutUrl = this.configService.get<string>('SSO_OIDC_LOGOUT_URL');

    if (!issuer || !clientId || !redirectUri) {
      throw new Error('OIDC config missing (SSO_OIDC_ISSUER/CLIENT_ID/REDIRECT_URL)');
    }

    return {
      issuer,
      clientId,
      clientSecret: clientSecret || undefined,
      redirectUri,
      scopes,
      prompt: prompt || undefined,
      usePkce: usePkceRaw ? parseBool(usePkceRaw) : true,
      tokenAuthMethod,
      skipTokenVerify,
      logoutUrl: logoutUrl || undefined,
    };
  }

  getSamlConfig(): SamlConfig {
    const entryPoint = this.configService.get<string>('SSO_SAML_ENTRY_POINT');
    const issuer = this.configService.get<string>('SSO_SAML_ISSUER');
    const callbackUrl = this.configService.get<string>('SSO_SAML_CALLBACK_URL');
    const idpCert = this.configService.get<string>('SSO_SAML_IDP_CERT');
    const audience = this.configService.get<string>('SSO_SAML_AUDIENCE');
    const acceptedClockSkewMsRaw = this.configService.get<string>('SSO_SAML_CLOCK_SKEW_MS');
    const disableRequestedAuthnContext = parseBool(
      this.configService.get<string>('SSO_SAML_DISABLE_AUTHN_CONTEXT'),
    );
    const forceAuthn = parseBool(this.configService.get<string>('SSO_SAML_FORCE_AUTHN'));
    const signatureAlgorithm =
      (this.configService.get<string>('SSO_SAML_SIGNATURE_ALGORITHM') as SamlConfig['signatureAlgorithm']) ??
      'sha256';
    const emailAttribute = this.configService.get<string>('SSO_SAML_EMAIL_ATTRIBUTE') ?? 'email';
    const emailAttributeFallbacksRaw = this.configService.get<string>('SSO_SAML_EMAIL_FALLBACKS');
    const logoutUrl = this.configService.get<string>('SSO_SAML_LOGOUT_URL');

    if (!entryPoint || !issuer || !callbackUrl || !idpCert) {
      throw new Error('SAML config missing (SSO_SAML_ENTRY_POINT/ISSUER/CALLBACK_URL/IDP_CERT)');
    }

    return {
      entryPoint,
      issuer,
      callbackUrl,
      idpCert,
      audience: audience || issuer,
      acceptedClockSkewMs: acceptedClockSkewMsRaw ? parseInt(acceptedClockSkewMsRaw, 10) : 5000,
      disableRequestedAuthnContext,
      forceAuthn,
      signatureAlgorithm,
      emailAttribute,
      emailAttributeFallbacks: emailAttributeFallbacksRaw
        ? emailAttributeFallbacksRaw.split(',').map((s) => s.trim())
        : ['mail', 'emailAddress', 'Email'],
      logoutUrl: logoutUrl || undefined,
    };
  }

  getProviders(): SsoProviderInfo[] {
    const providers: SsoProviderInfo[] = [];

    if (this.isOidcEnabled()) {
      providers.push({
        id: 'oidc',
        label: 'OIDC',
        loginUrl: '/auth/oidc/login',
      });
    }

    if (this.isSamlEnabled()) {
      providers.push({
        id: 'saml',
        label: 'SAML',
        loginUrl: '/auth/saml/login',
      });
    }

    return providers;
  }
}
