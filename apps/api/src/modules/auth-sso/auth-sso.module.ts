import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthSsoController } from './auth-sso.controller';
import { SsoConfigService } from './sso-config.service';
import { OidcService } from './oidc/oidc.service';
import { OidcController } from './oidc/oidc.controller';
import { OidcUserMapper } from './oidc/oidc-user-mapper';
import { SsoIdentityService } from './sso-identity.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { SamlController } from './saml/saml.controller';
import { SamlService } from './saml/saml.service';
import { SamlUserMapper } from './saml/saml-user-mapper';

@Module({
  imports: [ConfigModule, PrismaModule, UsersModule, AuthModule],
  controllers: [AuthSsoController, OidcController, SamlController],
  providers: [SsoConfigService, OidcService, OidcUserMapper, SamlService, SamlUserMapper, SsoIdentityService],
})
export class AuthSsoModule {}
