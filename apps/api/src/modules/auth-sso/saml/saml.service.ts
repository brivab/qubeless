import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SAML, Profile as SamlNodeProfile } from '@node-saml/node-saml';
import { SsoConfigService } from '../sso-config.service';
import { SamlConfig, SamlProfile } from '../sso.types';

@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);
  private samlInstance: SAML | null = null;
  private config: SamlConfig | null = null;

  constructor(private readonly ssoConfigService: SsoConfigService) {}

  private getSaml(): SAML {
    if (!this.ssoConfigService.isSamlEnabled()) {
      throw new UnauthorizedException('SAML is disabled');
    }

    if (!this.samlInstance || !this.config) {
      this.config = this.ssoConfigService.getSamlConfig();
      this.samlInstance = new SAML({
        entryPoint: this.config.entryPoint,
        issuer: this.config.issuer,
        callbackUrl: this.config.callbackUrl,
        idpCert: this.config.idpCert,
        audience: this.config.audience,
        acceptedClockSkewMs: this.config.acceptedClockSkewMs,
        disableRequestedAuthnContext: this.config.disableRequestedAuthnContext,
        forceAuthn: this.config.forceAuthn,
        signatureAlgorithm: this.config.signatureAlgorithm,
        // Security settings
        wantAssertionsSigned: true,
      });
    }

    return this.samlInstance;
  }

  async getLoginUrl(): Promise<string> {
    const saml = this.getSaml();
    try {
      const url = await saml.getAuthorizeUrlAsync('', '', {});
      return url;
    } catch (err) {
      this.logger.error('SAML getAuthorizeUrl failed', err);
      throw new UnauthorizedException('Failed to generate SAML login URL');
    }
  }

  async validateResponse(body: any): Promise<SamlProfile> {
    const saml = this.getSaml();

    try {
      const result = await saml.validatePostResponseAsync(body);
      if (!result || !result.profile) {
        throw new UnauthorizedException('SAML profile missing');
      }

      const profile = result.profile;

      // Validate timing constraints with configured skew
      this.validateTimingConstraints(profile);

      // Validate audience if present
      if (this.config?.audience) {
        this.validateAudience(profile);
      }

      // Validate issuer if present in response
      this.validateIssuer(profile);

      return this.extractProfile(profile);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error('SAML validation failed', (err as Error).message);
      // Never log the raw SAML response for security
      throw new UnauthorizedException('SAML validation failed');
    }
  }

  private validateTimingConstraints(profile: SamlNodeProfile): void {
    const now = Date.now();
    const skew = this.config?.acceptedClockSkewMs ?? 5000;

    // Check NotBefore
    if (profile.notBefore) {
      const notBeforeTime = new Date(profile.notBefore as string).getTime();
      if (now + skew < notBeforeTime) {
        this.logger.warn('SAML assertion not yet valid (NotBefore)');
        throw new UnauthorizedException('SAML assertion not yet valid');
      }
    }

    // Check NotOnOrAfter
    if (profile.notOnOrAfter) {
      const notOnOrAfterTime = new Date(profile.notOnOrAfter as string).getTime();
      if (now - skew >= notOnOrAfterTime) {
        this.logger.warn('SAML assertion expired (NotOnOrAfter)');
        throw new UnauthorizedException('SAML assertion expired');
      }
    }
  }

  private validateAudience(profile: SamlNodeProfile): void {
    const expectedAudience = this.config?.audience;
    const actualAudience = profile.audience;

    if (!actualAudience) {
      this.logger.warn('SAML response missing audience');
      throw new UnauthorizedException('SAML audience missing');
    }

    if (actualAudience !== expectedAudience) {
      this.logger.warn(`SAML audience mismatch: expected ${expectedAudience}, got ${actualAudience}`);
      throw new UnauthorizedException('SAML audience mismatch');
    }
  }

  private validateIssuer(profile: SamlNodeProfile): void {
    if (profile.issuer) {
      // Log issuer for audit purposes but don't fail if it doesn't match
      // Some IdPs use different issuer values
      this.logger.log(`SAML response from issuer: ${profile.issuer}`);
    }
  }

  private extractProfile(profile: SamlNodeProfile): SamlProfile {
    const emailAttribute = this.config?.emailAttribute ?? 'email';
    const emailFallbacks = this.config?.emailAttributeFallbacks ?? ['mail', 'emailAddress', 'Email'];

    let email: string | undefined;

    // Try configured primary attribute
    if (profile[emailAttribute]) {
      email = Array.isArray(profile[emailAttribute]) ? profile[emailAttribute][0] : profile[emailAttribute];
    }

    // Try fallbacks
    if (!email) {
      for (const fallback of emailFallbacks) {
        if (profile[fallback]) {
          email = Array.isArray(profile[fallback]) ? profile[fallback][0] : profile[fallback];
          if (email) {
            this.logger.log(`Using email from fallback attribute: ${fallback}`);
            break;
          }
        }
      }
    }

    // Try standard SAML nameID if still no email
    if (!email && profile.nameID) {
      const nameID = profile.nameID;
      // Check if nameID looks like an email
      if (typeof nameID === 'string' && nameID.includes('@')) {
        email = nameID;
        this.logger.log('Using nameID as email');
      }
    }

    return {
      nameID: profile.nameID,
      email,
      attributes: profile,
    };
  }
}
