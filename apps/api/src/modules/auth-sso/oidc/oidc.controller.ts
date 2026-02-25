import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { OidcService } from './oidc.service';
import { SsoConfigService } from '../sso-config.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('auth/oidc')
export class OidcController {
  constructor(
    private readonly oidcService: OidcService,
    private readonly ssoConfig: SsoConfigService,
  ) {}

  @Get('login')
  async login(@Res() reply: FastifyReply) {
    if (!this.ssoConfig.isOidcEnabled()) {
      return reply.status(501).send({ message: 'OIDC disabled' });
    }

    const url = await this.oidcService.buildLoginUrl();
    return reply.redirect(url);
  }

  @Get('callback')
  async callback(@Query() query: Record<string, string | string[] | undefined>, @Res() reply: FastifyReply) {
    if (!this.ssoConfig.isOidcEnabled()) {
      return reply.status(501).send({ message: 'OIDC disabled' });
    }

    const loginResponse = await this.oidcService.handleCallback(query);
    return reply.status(200).send(loginResponse);
  }
}
