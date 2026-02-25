import { ConfigService } from '@nestjs/config';
import { SsoConfigService } from './sso-config.service';

describe('SsoConfigService', () => {
  let service: SsoConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockValues = (values: Record<string, string | undefined>) => {
    mockConfigService.get.mockImplementation((key: string) => values[key]);
  };

  beforeEach(() => {
    service = new SsoConfigService(mockConfigService as unknown as ConfigService);
    jest.clearAllMocks();
  });

  describe('flags', () => {
    it('should parse enabled flags from config', () => {
      mockValues({
        SSO_OIDC_ENABLED: '1',
        SSO_SAML_ENABLED: 'true',
      });

      expect(service.isOidcEnabled()).toBe(true);
      expect(service.isSamlEnabled()).toBe(true);
    });

    it('should return disabled by default', () => {
      mockValues({});

      expect(service.isOidcEnabled()).toBe(false);
      expect(service.isSamlEnabled()).toBe(false);
    });
  });

  describe('getOidcConfig', () => {
    it('should throw when required fields are missing', () => {
      mockValues({
        SSO_OIDC_ISSUER: 'https://issuer.example.com',
      });

      expect(() => service.getOidcConfig()).toThrow(
        'OIDC config missing (SSO_OIDC_ISSUER/CLIENT_ID/REDIRECT_URL)',
      );
    });

    it('should return OIDC defaults when optional fields are not set', () => {
      mockValues({
        SSO_OIDC_ISSUER: 'https://issuer.example.com',
        SSO_OIDC_CLIENT_ID: 'client-id',
        SSO_OIDC_REDIRECT_URL: 'https://api.example.com/auth/oidc/callback',
      });

      const result = service.getOidcConfig();

      expect(result).toEqual({
        issuer: 'https://issuer.example.com',
        clientId: 'client-id',
        clientSecret: undefined,
        redirectUri: 'https://api.example.com/auth/oidc/callback',
        scopes: 'openid email profile',
        prompt: undefined,
        usePkce: true,
        tokenAuthMethod: 'client_secret_post',
        skipTokenVerify: false,
        logoutUrl: undefined,
      });
    });

    it('should parse optional OIDC values', () => {
      mockValues({
        SSO_OIDC_ISSUER: 'https://issuer.example.com',
        SSO_OIDC_CLIENT_ID: 'client-id',
        SSO_OIDC_CLIENT_SECRET: 'client-secret',
        SSO_OIDC_REDIRECT_URL: 'https://api.example.com/auth/oidc/callback',
        SSO_OIDC_SCOPES: 'openid profile',
        SSO_OIDC_PROMPT: 'login',
        SSO_OIDC_PKCE: 'false',
        SSO_OIDC_TOKEN_AUTH: 'client_secret_basic',
        SSO_OIDC_SKIP_TOKEN_VERIFY: '1',
        SSO_OIDC_LOGOUT_URL: 'https://issuer.example.com/logout',
      });

      const result = service.getOidcConfig();

      expect(result).toEqual({
        issuer: 'https://issuer.example.com',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://api.example.com/auth/oidc/callback',
        scopes: 'openid profile',
        prompt: 'login',
        usePkce: false,
        tokenAuthMethod: 'client_secret_basic',
        skipTokenVerify: true,
        logoutUrl: 'https://issuer.example.com/logout',
      });
    });
  });

  describe('getSamlConfig', () => {
    it('should throw when required fields are missing', () => {
      mockValues({
        SSO_SAML_ENTRY_POINT: 'https://idp.example.com/login',
      });

      expect(() => service.getSamlConfig()).toThrow(
        'SAML config missing (SSO_SAML_ENTRY_POINT/ISSUER/CALLBACK_URL/IDP_CERT)',
      );
    });

    it('should return SAML defaults when optional fields are not set', () => {
      mockValues({
        SSO_SAML_ENTRY_POINT: 'https://idp.example.com/login',
        SSO_SAML_ISSUER: 'qubeless',
        SSO_SAML_CALLBACK_URL: 'https://api.example.com/auth/saml/callback',
        SSO_SAML_IDP_CERT: '---CERT---',
      });

      const result = service.getSamlConfig();

      expect(result).toEqual({
        entryPoint: 'https://idp.example.com/login',
        issuer: 'qubeless',
        callbackUrl: 'https://api.example.com/auth/saml/callback',
        idpCert: '---CERT---',
        audience: 'qubeless',
        acceptedClockSkewMs: 5000,
        disableRequestedAuthnContext: false,
        forceAuthn: false,
        signatureAlgorithm: 'sha256',
        emailAttribute: 'email',
        emailAttributeFallbacks: ['mail', 'emailAddress', 'Email'],
        logoutUrl: undefined,
      });
    });

    it('should parse optional SAML values', () => {
      mockValues({
        SSO_SAML_ENTRY_POINT: 'https://idp.example.com/login',
        SSO_SAML_ISSUER: 'qubeless',
        SSO_SAML_CALLBACK_URL: 'https://api.example.com/auth/saml/callback',
        SSO_SAML_IDP_CERT: '---CERT---',
        SSO_SAML_AUDIENCE: 'audience-x',
        SSO_SAML_CLOCK_SKEW_MS: '1200',
        SSO_SAML_DISABLE_AUTHN_CONTEXT: 'true',
        SSO_SAML_FORCE_AUTHN: '1',
        SSO_SAML_SIGNATURE_ALGORITHM: 'sha512',
        SSO_SAML_EMAIL_ATTRIBUTE: 'mail',
        SSO_SAML_EMAIL_FALLBACKS: 'mail, emailAddress , Email',
        SSO_SAML_LOGOUT_URL: 'https://idp.example.com/logout',
      });

      const result = service.getSamlConfig();

      expect(result).toEqual({
        entryPoint: 'https://idp.example.com/login',
        issuer: 'qubeless',
        callbackUrl: 'https://api.example.com/auth/saml/callback',
        idpCert: '---CERT---',
        audience: 'audience-x',
        acceptedClockSkewMs: 1200,
        disableRequestedAuthnContext: true,
        forceAuthn: true,
        signatureAlgorithm: 'sha512',
        emailAttribute: 'mail',
        emailAttributeFallbacks: ['mail', 'emailAddress', 'Email'],
        logoutUrl: 'https://idp.example.com/logout',
      });
    });
  });

  describe('getProviders', () => {
    it('should expose only enabled providers', () => {
      mockValues({
        SSO_OIDC_ENABLED: 'true',
        SSO_SAML_ENABLED: 'false',
      });

      expect(service.getProviders()).toEqual([
        {
          id: 'oidc',
          label: 'OIDC',
          loginUrl: '/auth/oidc/login',
        },
      ]);
    });
  });
});
