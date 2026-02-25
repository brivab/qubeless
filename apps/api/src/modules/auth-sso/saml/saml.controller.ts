import { Body, Controller, Get, Logger, Post, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { SsoConfigService } from '../sso-config.service';
import { SamlService } from './saml.service';
import { SamlUserMapper } from './saml-user-mapper';
import { AuthService } from '../../auth/auth.service';
import { SsoProvider } from '@prisma/client';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('auth/saml')
export class SamlController {
  private readonly logger = new Logger(SamlController.name);

  constructor(
    private readonly ssoConfig: SsoConfigService,
    private readonly samlService: SamlService,
    private readonly samlUserMapper: SamlUserMapper,
    private readonly authService: AuthService,
  ) {}

  @Get('login')
  async login(@Res() reply: FastifyReply) {
    if (!this.ssoConfig.isSamlEnabled()) {
      return reply.status(404).send({ message: 'SAML disabled' });
    }

    try {
      const loginUrl = await this.samlService.getLoginUrl();
      this.logger.log('SAML login initiated');
      return reply.redirect(loginUrl);
    } catch (error) {
      this.logger.error('SAML login failed', error);
      return reply.status(500).send({ message: 'SAML login failed' });
    }
  }

  @Post('callback')
  async callback(@Body() body: any, @Res() reply: FastifyReply) {
    if (!this.ssoConfig.isSamlEnabled()) {
      return reply.status(404).send({ message: 'SAML disabled' });
    }

    try {
      // Validate SAML response with all security checks
      const profile = await this.samlService.validateResponse(body);

      // Resolve or create user (non-destructive)
      const user = await this.samlUserMapper.resolveUser(SsoProvider.SAML, profile);

      // Generate JWT (same as local auth)
      const loginResponse = await this.authService.loginWithUser(user);

      this.logger.log(`SAML login successful for user: ${user.email}`);

      return reply.status(200).send(loginResponse);
    } catch (error) {
      this.logger.error('SAML callback failed', (error as Error).message);
      // Never expose internal error details for security
      return reply.status(401).send({ message: 'SAML authentication failed' });
    }
  }
}
