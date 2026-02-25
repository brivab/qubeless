import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from './audit.service';
import { AuditController, AdminAuditController } from './audit.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [AuditController, AdminAuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
