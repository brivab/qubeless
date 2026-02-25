import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateQualityGateDto } from './dto/create-quality-gate.dto';
import { CreateQualityGateConditionDto } from './dto/create-quality-gate-condition.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, QualityGateScope } from '@prisma/client';
import { UpsertQualityGateDto } from './dto/upsert-quality-gate.dto';

@Injectable()
export class QualityGatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly auditService: AuditService,
  ) {}

  async createForProject(projectKey: string, dto: CreateQualityGateDto, userId?: string) {
    const project = await this.projectsService.getByKeyOrThrow(projectKey);

    const existing = await this.prisma.qualityGate.findFirst({
      where: { projectId: project.id },
      include: { conditions: true },
    });

    if (existing) {
      const updated = await this.prisma.qualityGate.update({
        where: { id: existing.id },
        data: { name: dto.name },
        include: { conditions: true },
      });

      await this.auditService.log({
        actorUserId: userId,
        action: AuditAction.QUALITY_GATE_UPDATE,
        targetType: 'QualityGate',
        targetId: updated.id,
        metadata: {
          projectKey,
          projectId: project.id,
          gateName: updated.name,
        },
      });

      return updated;
    }

    const created = await this.prisma.qualityGate.create({
      data: {
        name: dto.name,
        projectId: project.id,
      },
      include: { conditions: true },
    });

    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.QUALITY_GATE_CREATE,
      targetType: 'QualityGate',
      targetId: created.id,
      metadata: {
        projectKey,
        projectId: project.id,
        gateName: created.name,
      },
    });

    return created;
  }

  async upsertForProject(projectKey: string, dto: UpsertQualityGateDto, userId?: string) {
    const project = await this.projectsService.getByKeyOrThrow(projectKey);

    const existing = await this.prisma.qualityGate.findFirst({
      where: { projectId: project.id },
    });

    const gate = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.qualityGate.update({
          where: { id: existing.id },
          data: { name: dto.name },
        });

        if (dto.conditions) {
          await tx.qualityGateCondition.deleteMany({ where: { qualityGateId: existing.id } });
          if (dto.conditions.length > 0) {
            await tx.qualityGateCondition.createMany({
              data: dto.conditions.map((condition) => ({
                qualityGateId: existing.id,
                metric: condition.metric,
                operator: condition.operator,
                threshold: condition.threshold,
                scope: condition.scope ?? QualityGateScope.ALL,
              })),
            });
          }
        }

        return tx.qualityGate.findUnique({
          where: { id: existing.id },
          include: { conditions: true },
        });
      }

      const created = await tx.qualityGate.create({
        data: { name: dto.name, projectId: project.id },
      });

      if (dto.conditions && dto.conditions.length > 0) {
        await tx.qualityGateCondition.createMany({
          data: dto.conditions.map((condition) => ({
            qualityGateId: created.id,
            metric: condition.metric,
            operator: condition.operator,
            threshold: condition.threshold,
            scope: condition.scope ?? QualityGateScope.ALL,
          })),
        });
      }

      return tx.qualityGate.findUnique({
        where: { id: created.id },
        include: { conditions: true },
      });
    });

    if (!gate) {
      throw new NotFoundException(`Quality gate for project ${projectKey} not found`);
    }

    await this.auditService.log({
      actorUserId: userId,
      action: existing ? AuditAction.QUALITY_GATE_UPDATE : AuditAction.QUALITY_GATE_CREATE,
      targetType: 'QualityGate',
      targetId: gate.id,
      metadata: {
        projectKey,
        projectId: project.id,
        gateName: gate.name,
        conditionsCount: gate.conditions?.length ?? 0,
      },
    });

    return gate;
  }

  async findForProject(projectKey: string) {
    const project = await this.projectsService.getByKeyOrThrow(projectKey);
    const gate = await this.prisma.qualityGate.findFirst({
      where: { projectId: project.id },
      include: { conditions: true },
    });

    if (!gate) {
      throw new NotFoundException(`Quality gate for project ${projectKey} not found`);
    }

    return gate;
  }

  async addCondition(qualityGateId: string, dto: CreateQualityGateConditionDto) {
    const gate = await this.prisma.qualityGate.findUnique({
      where: { id: qualityGateId },
    });

    if (!gate) {
      throw new NotFoundException(`Quality gate ${qualityGateId} not found`);
    }

    await this.prisma.qualityGateCondition.create({
      data: {
        qualityGateId,
        metric: dto.metric,
        operator: dto.operator,
        threshold: dto.threshold,
        scope: dto.scope ?? QualityGateScope.ALL,
      },
    });

    return this.prisma.qualityGate.findUnique({
      where: { id: qualityGateId },
      include: { conditions: true },
    });
  }
}
