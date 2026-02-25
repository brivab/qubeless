import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { AnalysisMetricsListener } from './analysis-metrics.listener';

@Global()
@Module({
  providers: [MetricsService, AnalysisMetricsListener],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
