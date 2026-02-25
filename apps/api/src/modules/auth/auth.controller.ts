import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LdapLoginDto } from './dto/ldap-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthPayload } from './auth.types';
import { UsersService } from '../users/users.service';
import { LoginResponse, UserDTO } from '@qubeless/shared';
import { ApiOperation } from '@nestjs/swagger';
import { LdapService } from './ldap/ldap.service';
import { MfaCodeDto } from './dto/mfa-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly ldapService: LdapService,
  ) {}

  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 tentatives par minute
  @ApiOperation({ summary: 'Login admin (JWT)', description: 'Renvoie un JWT pour les appels sécurisés.' })
  async login(@Body() credentials: LoginDto): Promise<LoginResponse> {
    return this.authService.login(credentials);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('login/ldap')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 tentatives par minute
  @ApiOperation({ summary: 'Login via LDAP', description: 'Authentification via LDAP/Active Directory.' })
  async loginLdap(@Body() credentials: LdapLoginDto): Promise<LoginResponse> {
    return this.authService.loginWithLdap(credentials);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('ldap/enabled')
  @ApiOperation({ summary: 'Check if LDAP is enabled', description: 'Retourne si LDAP est activé.' })
  async ldapEnabled(): Promise<{ enabled: boolean }> {
    return { enabled: this.ldapService.isEnabled() };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Utilisateur courant', description: 'Retourne le profil associé au JWT.' })
  async me(@CurrentUser() user: AuthPayload): Promise<UserDTO> {
    const found = await this.usersService.findById(user.sub);
    const dto = this.usersService.toUserDTO(found);
    return dto as UserDTO;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('mfa/setup')
  @ApiOperation({ summary: 'Initialiser MFA', description: "Génère un secret MFA et l'URL otpauth." })
  async setupMfa(@CurrentUser() user: AuthPayload): Promise<{ secret: string; otpauthUrl: string }> {
    return this.authService.setupMfa(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('mfa/confirm')
  @ApiOperation({ summary: 'Confirmer MFA', description: "Valide le code et active l'MFA." })
  async confirmMfa(@CurrentUser() user: AuthPayload, @Body() payload: MfaCodeDto): Promise<{ enabled: boolean }> {
    return this.authService.confirmMfa(user.sub, payload.code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('mfa/disable')
  @ApiOperation({ summary: 'Désactiver MFA', description: "Désactive l'MFA pour l'utilisateur." })
  async disableMfa(@CurrentUser() user: AuthPayload, @Body() payload: MfaCodeDto): Promise<{ enabled: boolean }> {
    return this.authService.disableMfa(user.sub, payload.code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('mfa/status')
  @ApiOperation({ summary: 'Statut MFA', description: "Retourne si l'MFA est activée." })
  async mfaStatus(@CurrentUser() user: AuthPayload): Promise<{ enabled: boolean }> {
    return this.authService.getMfaStatus(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({
    summary: 'Logout',
    description:
      'Logout utilisateur. Pour SSO, retourne optionnellement une URL de logout IdP si configurée.',
  })
  async logout(@CurrentUser() user: AuthPayload): Promise<{ ssoLogoutUrl?: string }> {
    const logoutInfo = await this.authService.logout(user.sub);
    return logoutInfo;
  }
}
