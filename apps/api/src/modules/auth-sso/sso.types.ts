export type SsoProviderId = 'oidc' | 'saml';

export interface SsoProviderInfo {
  id: SsoProviderId;
  label: string;
  loginUrl: string;
}

export type OidcTokenAuthMethod = 'client_secret_post' | 'client_secret_basic';

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string;
  prompt?: string;
  usePkce: boolean;
  tokenAuthMethod: OidcTokenAuthMethod;
  skipTokenVerify: boolean;
  logoutUrl?: string;
}

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
}

export interface OidcProfile {
  sub?: string;
  email?: string | null;
}

export interface SamlConfig {
  entryPoint: string;
  issuer: string;
  callbackUrl: string;
  idpCert: string;
  audience?: string;
  acceptedClockSkewMs: number;
  disableRequestedAuthnContext: boolean;
  forceAuthn: boolean;
  signatureAlgorithm: 'sha256' | 'sha512';
  emailAttribute: string;
  emailAttributeFallbacks: string[];
  logoutUrl?: string;
}

export interface SamlProfile {
  nameID?: string;
  email?: string;
  attributes?: Record<string, any>;
}
