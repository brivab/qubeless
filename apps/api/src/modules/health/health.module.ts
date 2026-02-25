import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalysisQueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [PrismaModule],
  providers: [HealthService, AnalysisQueueService, StorageService],
  exports: [HealthService],
})
export class HealthModule {}
