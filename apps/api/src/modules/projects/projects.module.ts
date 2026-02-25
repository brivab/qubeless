import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LanguageDetectionService } from './language-detection.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, AuthorizationModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, LanguageDetectionService],
  exports: [ProjectsService, LanguageDetectionService],
})
export class ProjectsModule {}
