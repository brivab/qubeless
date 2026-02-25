import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Interceptor to collect database latency metrics
 * This interceptor measures the duration of database operations
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.metricsService.isEnabled()) {
      return next.handle();
    }

    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    const route = request?.route?.path || 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - start) / 1000;
          // Only log operations that took more than 100ms
          if (duration > 0.1) {
            this.logger.debug({ route, duration }, 'Request duration');
          }
        },
        error: (error) => {
          const duration = (Date.now() - start) / 1000;
          this.logger.warn({ route, duration, error: error?.message }, 'Request failed');
        },
      }),
    );
  }
}
