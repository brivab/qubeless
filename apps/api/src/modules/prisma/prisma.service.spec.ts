import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should connect to database and log success', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined as never);
      const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith('Connected to database');
    });

    it('should propagate connection errors', async () => {
      const error = new Error('connection failed');
      jest.spyOn(service, '$connect').mockRejectedValue(error);

      await expect(service.onModuleInit()).rejects.toThrow(error);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from database', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined as never);

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
  });
});
