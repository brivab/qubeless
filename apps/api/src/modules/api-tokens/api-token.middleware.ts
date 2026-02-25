import { Injectable, NestMiddleware } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class ApiTokenMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async use(req: FastifyRequest, _res: FastifyReply, next: () => void) {
    const auth = req.headers.authorization;
    if (!auth || typeof auth !== 'string' || !auth.toLowerCase().startsWith('bearer ')) {
      return next();
    }
    const token = auth.slice(7).trim();
    if (!token) return next();

    const tokenHash = this.hashToken(token);
    const record = await this.prisma.apiToken.findUnique({ where: { tokenHash } });
    if (record) {
      (req as any).apiToken = record;
      await this.prisma.apiToken.update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      });
    }
    return next();
  }
}
