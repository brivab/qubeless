import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { LdapLoginDto } from './dto/ldap-login.dto';
import { LoginResponse } from '@qubeless/shared';
import * as bcrypt from 'bcrypt';
import { AuthPayload } from './auth.types';
import { User, SsoProvider, AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LdapService } from './ldap/ldap.service';
import { buildOtpAuthUrl, generateBase32Secret, verifyTotp } from './mfa.utils';

export interface LogoutInfo {
  ssoLogoutUrl?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
    private readonly ldapService: LdapService,
  ) {}

  private async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    return matches ? user : null;
  }

  async login(credentials: LoginDto): Promise<LoginResponse> {
    const user = await this.validateUser(credentials.email, credentials.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.ensureMfa(user, credentials.mfaCode);

    await this.auditService.log({
      actorUserId: user.id,
      action: AuditAction.AUTH_LOGIN,
      metadata: { method: 'local' },
    });

    return this.buildLoginResponse(user);
  }

  async loginWithUser(user: User, method: 'sso' | 'local' | 'ldap' = 'sso'): Promise<LoginResponse> {
    await this.auditService.log({
      actorUserId: user.id,
      action: AuditAction.AUTH_LOGIN,
      metadata: { method },
    });

    return this.buildLoginResponse(user);
  }

  async loginWithLdap(credentials: LdapLoginDto): Promise<LoginResponse> {
    if (!this.ldapService.isEnabled()) {
      throw new UnauthorizedException('LDAP authentication is not enabled');
    }

    // 1. Authenticate with LDAP
    const ldapUser = await this.ldapService.authenticate(credentials.username, credentials.password);

    if (!ldapUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Find or create user in DB
    let user = await this.usersService.findByEmail(ldapUser.email);

    if (!user) {
      // Create user with LDAP identity
      user = await this.prismaService.user.create({
        data: {
          email: ldapUser.email,
          passwordHash: '', // No password for LDAP users
          globalRole: 'USER',
          ssoIdentities: {
            create: {
              provider: SsoProvider.LDAP,
              subject: ldapUser.username,
              email: ldapUser.email,
            },
          },
        },
      });
      this.logger.log(`Created new user from LDAP: ${ldapUser.email}`);
    } else {
      // Check if user already has LDAP identity
      const existingIdentity = await this.prismaService.ssoIdentity.findUnique({
        where: {
          provider_subject: {
            provider: SsoProvider.LDAP,
            subject: ldapUser.username,
          },
        },
      });

      if (!existingIdentity) {
        // Link LDAP identity to existing user
        await this.prismaService.ssoIdentity.create({
          data: {
            provider: SsoProvider.LDAP,
            subject: ldapUser.username,
            email: ldapUser.email,
            userId: user.id,
          },
        });
        this.logger.log(`Linked LDAP identity to existing user: ${ldapUser.email}`);
      }
    }

    await this.ensureMfa(user, credentials.mfaCode);

    await this.auditService.log({
      actorUserId: user.id,
      action: AuditAction.AUTH_LOGIN,
      metadata: { method: 'ldap', username: ldapUser.username },
    });

    return this.buildLoginResponse(user);
  }

  async ensureAdminUser(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    if (nodeEnv === 'production' && (!adminEmail || !adminPassword)) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required in production');
    }
    const resolvedAdminEmail = adminEmail ?? 'admin@example.com';
    const resolvedAdminPassword = adminPassword ?? 'admin123';
    const existing = await this.usersService.findByEmail(resolvedAdminEmail);

    if (existing) {
      this.logger.log(`Admin user already exists (${resolvedAdminEmail})`);
      return;
    }

    await this.usersService.createUser({
      email: resolvedAdminEmail,
      password: resolvedAdminPassword,
    });

    this.logger.log(`Admin user created (${resolvedAdminEmail})`);
  }

  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA already enabled');
    }

    const secret = generateBase32Secret();
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret,
        mfaEnabled: false,
      },
    });

    const issuer = this.getMfaIssuer();
    const otpauthUrl = buildOtpAuthUrl({
      issuer,
      accountName: user.email,
      secret,
    });

    return { secret, otpauthUrl };
  }

  async confirmMfa(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.mfaSecret) {
      throw new BadRequestException('MFA setup not initialized');
    }

    const valid = verifyTotp(user.mfaSecret, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.prismaService.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { enabled: true };
  }

  async disableMfa(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.mfaSecret || !user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const valid = verifyTotp(user.mfaSecret, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    return { enabled: false };
  }

  async getMfaStatus(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { enabled: user.mfaEnabled };
  }

  async logout(userId: string): Promise<LogoutInfo> {
    // Check if user has SSO identity
    const ssoIdentity = await this.prismaService.ssoIdentity.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.AUTH_LOGOUT,
      metadata: {
        method: ssoIdentity ? 'sso' : 'local',
        provider: ssoIdentity?.provider,
      },
    });

    if (!ssoIdentity) {
      // Local user - no additional action needed
      this.logger.log(`Local logout for user ${userId}`);
      return {};
    }

    // SSO user - check for IdP logout URL
    const provider = ssoIdentity.provider;
    let ssoLogoutUrl: string | undefined;

    if (provider === SsoProvider.OIDC) {
      const oidcLogoutUrl = this.configService.get<string>('SSO_OIDC_LOGOUT_URL');
      if (oidcLogoutUrl) {
        ssoLogoutUrl = oidcLogoutUrl;
        this.logger.log(`OIDC logout URL available for user ${userId}`);
      }
    } else if (provider === SsoProvider.SAML) {
      const samlLogoutUrl = this.configService.get<string>('SSO_SAML_LOGOUT_URL');
      if (samlLogoutUrl) {
        ssoLogoutUrl = samlLogoutUrl;
        this.logger.log(`SAML logout URL available for user ${userId}`);
      }
    }

    this.logger.log(`SSO logout for user ${userId} (provider: ${provider})`);
    return { ssoLogoutUrl };
  }

  private async buildLoginResponse(user: User): Promise<LoginResponse> {
    const payload: AuthPayload = {
      sub: user.id,
      email: user.email,
      role: user.globalRole,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const userDto = this.usersService.toUserDTO(user);

    return { accessToken, user: userDto! };
  }

  private getMfaIssuer(): string {
    return this.configService.get<string>('MFA_ISSUER') ?? 'Qubeless';
  }

  private isMfaBypassEnabled(): boolean {
    const raw = (this.configService.get<string>('MFA_BYPASS') ?? '').toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  private async ensureMfa(user: User, code?: string | null): Promise<void> {
    if (this.isMfaBypassEnabled()) {
      return;
    }
    if (!user.mfaEnabled) {
      return;
    }
    if (!user.mfaSecret) {
      this.logger.warn(`User ${user.id} has MFA enabled without a secret`);
      throw new UnauthorizedException('MFA setup required');
    }
    if (!code) {
      throw new UnauthorizedException('MFA code required');
    }
    const valid = verifyTotp(user.mfaSecret, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid MFA code');
    }
  }
}
