import { Module, forwardRef } from '@nestjs/common';
import { AnalysesService } from './analyses.service';
import { AnalysesController } from './analyses.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { AnalyzersModule } from '../analyzers/analyzers.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { AnalysesArtifactsController } from './analyses.artifacts.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CoverageModule } from '../coverage/coverage.module';
import { TechnicalDebtService } from './technical-debt.service';

@Module({
  imports: [
    PrismaModule,
    ProjectsModule,
    AnalyzersModule,
    QueueModule,
    StorageModule,
    AuthModule,
    CoverageModule,
    forwardRef(() => AuditModule),
  ],
  controllers: [AnalysesController, AnalysesArtifactsController],
  providers: [AnalysesService, TechnicalDebtService],
  exports: [AnalysesService],
})
export class AnalysesModule {}
