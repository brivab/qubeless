import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiOrJwtGuard } from './guards/api-or-jwt.guard';
import { AdminGuard } from './guards/admin.guard';
import { AuditModule } from '../audit/audit.module';
import { LdapService } from './ldap/ldap.service';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => UsersModule),
    PrismaModule,
    forwardRef(() => AuditModule),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
        if (!jwtSecret && nodeEnv === 'production') {
          throw new Error('JWT_SECRET is required in production');
        }

        return {
          secret: jwtSecret ?? 'changeme',
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') ?? '1d',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LdapService, JwtStrategy, JwtAuthGuard, ApiOrJwtGuard, AdminGuard],
  exports: [AuthService, LdapService, JwtAuthGuard, ApiOrJwtGuard, AdminGuard, JwtModule],
})
export class AuthModule {}
