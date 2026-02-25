import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SsoProvider, User } from '@prisma/client';
import { UsersService } from '../../users/users.service';
import { SsoIdentityService } from '../sso-identity.service';
import { SamlProfile } from '../sso.types';

@Injectable()
export class SamlUserMapper {
  constructor(
    private readonly usersService: UsersService,
    private readonly ssoIdentityService: SsoIdentityService,
  ) {}

  async resolveUser(provider: SsoProvider, profile: SamlProfile): Promise<User> {
    const subject = profile.nameID;
    const email = profile.email ?? undefined;

    if (!subject) {
      throw new UnauthorizedException('SAML subject (nameID) missing');
    }

    if (!email) {
      throw new UnauthorizedException('SAML email missing');
    }

    // Check if identity already exists (non-destructive)
    const existingIdentity = await this.ssoIdentityService.findByProviderSubject(provider, subject);
    if (existingIdentity?.user) {
      return existingIdentity.user;
    }

    // Try to find existing user by email (non-destructive linking)
    let user = await this.usersService.findByEmail(email);
    if (!user) {
      // Create new SSO user
      user = await this.usersService.createSsoUser(email);
    }

    // Link SSO identity to user
    await this.ssoIdentityService.createIdentity({
      provider,
      subject,
      email,
      userId: user.id,
    });

    return user;
  }
}
