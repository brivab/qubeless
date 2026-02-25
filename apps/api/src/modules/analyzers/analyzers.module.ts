import { Module, forwardRef } from '@nestjs/common';
import { AnalyzersService } from './analyzers.service';
import { AnalyzersController } from './analyzers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [PrismaModule, ProjectsModule, AuthorizationModule, forwardRef(() => AuditModule)],
  controllers: [AnalyzersController],
  providers: [AnalyzersService],
  exports: [AnalyzersService],
})
export class AnalyzersModule {}
