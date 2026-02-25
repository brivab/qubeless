import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'prom-client';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let loggerLogSpy: jest.SpyInstance;
  const mockConfigService = {
    get: jest.fn(),
  };

  beforeAll(() => {
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    loggerLogSpy.mockRestore();
  });

  describe('when disabled', () => {
    it('should disable metrics and return disabled payload', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'METRICS_ENABLED') return 'false';
        return defaultValue;
      });
      const collectSpy = jest
        .spyOn(client, 'collectDefaultMetrics')
        .mockImplementation(() => undefined);

      const service = new MetricsService(mockConfigService as unknown as ConfigService);

      expect(service.isEnabled()).toBe(false);
      expect(await service.getMetrics()).toBe('# Metrics disabled\n');
      expect(service.getContentType()).toBe('text/plain; version=0.0.4; charset=utf-8');

      collectSpy.mockRestore();
    });
  });

  describe('when enabled', () => {
    it('should collect defaults, expose metrics and reset counters', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'METRICS_ENABLED') return 'true';
        return defaultValue;
      });
      const collectSpy = jest
        .spyOn(client, 'collectDefaultMetrics')
        .mockImplementation(() => undefined);

      const service = new MetricsService(mockConfigService as unknown as ConfigService);

      expect(service.isEnabled()).toBe(true);

      service.analysesTotal.inc({ project: 'project-a', status: 'completed' }, 2);
      let metrics = await service.getMetrics();
      expect(metrics).toContain('analyses_total');
      expect(metrics).toContain('project="project-a"');
      expect(metrics).toContain('status="completed"');
      expect(metrics).toContain(' 2');

      service.reset();
      metrics = await service.getMetrics();
      expect(metrics).toContain('analyses_total');
      expect(metrics).toContain(' 0');

      collectSpy.mockRestore();
    });

    it('should treat case-insensitive true as enabled', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'METRICS_ENABLED') return 'TRUE';
        return defaultValue;
      });
      const collectSpy = jest
        .spyOn(client, 'collectDefaultMetrics')
        .mockImplementation(() => undefined);

      const service = new MetricsService(mockConfigService as unknown as ConfigService);

      expect(service.isEnabled()).toBe(true);

      collectSpy.mockRestore();
    });
  });
});
