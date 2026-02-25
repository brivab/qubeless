import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SsoProvider, User } from '@prisma/client';
import { UsersService } from '../../users/users.service';
import { SsoIdentityService } from '../sso-identity.service';
import { OidcProfile } from '../sso.types';

@Injectable()
export class OidcUserMapper {
  constructor(
    private readonly usersService: UsersService,
    private readonly ssoIdentityService: SsoIdentityService,
  ) {}

  async resolveUser(provider: SsoProvider, profile: OidcProfile): Promise<User> {
    const subject = profile.sub;
    const email = profile.email ?? undefined;

    if (!subject) {
      throw new UnauthorizedException('OIDC subject missing');
    }

    if (!email) {
      throw new UnauthorizedException('OIDC email missing');
    }

    const existingIdentity = await this.ssoIdentityService.findByProviderSubject(provider, subject);
    if (existingIdentity?.user) {
      return existingIdentity.user;
    }

    let user = await this.usersService.findByEmail(email);
    if (!user) {
      user = await this.usersService.createSsoUser(email);
    }

    await this.ssoIdentityService.createIdentity({
      provider,
      subject,
      email,
      userId: user.id,
    });

    return user;
  }
}
