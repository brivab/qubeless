import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { AppController } from './app.controller';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthSsoModule } from './modules/auth-sso/auth-sso.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AnalysesModule } from './modules/analyses/analyses.module';
import { QualityGatesModule } from './modules/quality-gates/quality-gates.module';
import { AnalyzersModule } from './modules/analyzers/analyzers.module';
import { StorageModule } from './modules/storage/storage.module';
import { ApiTokensModule } from './modules/api-tokens/api-tokens.module';
import { ApiTokenMiddleware } from './modules/api-tokens/api-token.middleware';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { ProjectMembersModule } from './modules/project-members/project-members.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { CoverageModule } from './modules/coverage/coverage.module';
import { DuplicationModule } from './modules/duplication/duplication.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { ChatNotificationsModule } from './modules/chat-notifications/chat-notifications.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { LlmProvidersModule } from './modules/llm-providers/llm-providers.module';
import { LlmPromptsModule } from './modules/llm-prompts/llm-prompts.module';
import { VcsTokensModule } from './modules/vcs-tokens/vcs-tokens.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 1000, // 1 seconde
          limit: 10, // 10 requêtes max
        },
        {
          name: 'medium',
          ttl: 60000, // 1 minute
          limit: 100, // 100 requêtes max
        },
        {
          name: 'long',
          ttl: 900000, // 15 minutes
          limit: 1000, // 1000 requêtes max
        },
      ],
      storage: new ThrottlerStorageRedisService({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: parseInt(process.env.REDIS_DB || '0'),
      }),
    }),
    PrismaModule,
    MetricsModule,
    HealthModule,
    UsersModule,
    AuthModule,
    AuthSsoModule,
    AuthorizationModule,
    OrganizationsModule,
    ProjectsModule,
    ProjectMembersModule,
    AnalysesModule,
    QualityGatesModule,
    AnalyzersModule,
    StorageModule,
    ApiTokensModule,
    WebhooksModule,
    AuditModule,
    CoverageModule,
    DuplicationModule,
    PortfolioModule,
    ChatNotificationsModule,
    NotificationsModule,
    LlmProvidersModule,
    LlmPromptsModule,
    VcsTokensModule,
  ],
  controllers: [AppController],
  providers: [
    ApiTokenMiddleware,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiTokenMiddleware).forRoutes('*');
  }
}
