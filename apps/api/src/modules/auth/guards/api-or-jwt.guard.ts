import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class ApiOrJwtGuard implements CanActivate {
  constructor(private readonly jwtGuard: JwtAuthGuard, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const headerAuth: string | undefined = (req.headers as any)?.authorization;
    const bearer = headerAuth && typeof headerAuth === 'string' && headerAuth.toLowerCase().startsWith('bearer ')
      ? headerAuth.slice(7).trim()
      : null;

    // Try middleware-populated token first, else resolve from header directly
    let token = (req as any).apiToken;
    if (!token && bearer) {
      const tokenHash = this.hashToken(bearer);
      token = await this.prisma.apiToken.findUnique({ where: { tokenHash } });
    }

    if (token) {
      // Enforce project restriction if present on token
      const params = req.params ?? {};
      const projectKey = params.key ?? params.projectKey ?? null;
      const analysisId = params.id ?? null;

      if (token.projectId) {
        if (projectKey) {
          const project = await this.prisma.project.findUnique({ where: { key: projectKey }, select: { id: true } });
          // Autoriser si le projet n'existe pas encore (pour permettre la création), sinon restreindre
          return !project || project.id === token.projectId;
        }
        if (analysisId) {
          const analysis = await this.prisma.analysis.findUnique({
            where: { id: analysisId },
            select: { projectId: true },
          });
          return analysis?.projectId === token.projectId;
        }
      }
      return true;
    }

    // Fallback to JWT guard
    const result = await this.jwtGuard.canActivate(context);
    return result as boolean;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
