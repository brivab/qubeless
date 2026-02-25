import { Controller, Get, UseGuards } from '@nestjs/common';
import { SsoConfigService } from './sso-config.service';
import { SsoProviderInfo } from './sso.types';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('auth/sso')
export class AuthSsoController {
  constructor(private readonly ssoConfig: SsoConfigService) {}

  @Get('providers')
  getProviders(): SsoProviderInfo[] {
    return this.ssoConfig.getProviders();
  }
}
