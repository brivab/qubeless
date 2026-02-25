import { Module, forwardRef } from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';
import { ApiTokensController } from './api-tokens.controller';
import { ApiTokenMiddleware } from './api-token.middleware';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuditModule)],
  controllers: [ApiTokensController],
  providers: [ApiTokensService, ApiTokenMiddleware],
  exports: [ApiTokensService, ApiTokenMiddleware],
})
export class ApiTokensModule {}
