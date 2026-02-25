import { Module } from '@nestjs/common';
import { AnalysisQueueService } from './queue.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [AnalysisQueueService],
  exports: [AnalysisQueueService],
})
export class QueueModule {}
