import { Module, forwardRef } from '@nestjs/common';
import { QualityGatesService } from './quality-gates.service';
import { QualityGatesController } from './quality-gates.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, ProjectsModule, AuthModule, forwardRef(() => AuditModule)],
  controllers: [QualityGatesController],
  providers: [QualityGatesService],
})
export class QualityGatesModule {}
