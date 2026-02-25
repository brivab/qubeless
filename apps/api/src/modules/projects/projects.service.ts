import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { LeakPeriodType, AuditAction, Prisma, LlmProvider } from '@prisma/client';
import { ProjectMetricsQueryDto } from './dto/project-metrics-query.dto';
import { randomUUID } from 'node:crypto';
import { UpdateRuleProfileRulesDto } from './dto/update-rule-profile-rules.dto';
import { CreateRuleProfileDto } from './dto/create-rule-profile.dto';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateSmtpConfigDto } from './dto/update-smtp-config.dto';
import { UpdateProjectLlmSettingsDto, LlmOverridesDto } from './dto/update-project-llm-settings.dto';
import { AuditService } from '../audit/audit.service';
import { LanguageDetectionService } from './language-detection.service';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly languageDetectionService: LanguageDetectionService,
  ) {}

  async create(data: CreateProjectDto, userId?: string) {
    // Validate organization exists
    const org = await this.prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!org) {
      throw new NotFoundException(`Organization not found`);
    }

    const ruleProfileId = randomUUID();

    const project = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          key: data.key,
          name: data.name,
          description: data.description,
          organizationId: data.organizationId,
          branches: {
            create: {
              name: 'main',
              isDefault: true,
            },
          },
        },
      });

      await (tx as any).ruleProfile.create({
        data: {
          id: ruleProfileId,
          name: 'Default',
          projectId: project.id,
        },
      });

      await tx.project.update({
        where: { id: project.id },
        data: { activeRuleProfileId: ruleProfileId } as any,
      });

      // Auto-add creator as PROJECT_ADMIN if userId is provided
      if (userId) {
        await tx.projectMembership.create({
          data: {
            userId,
            projectId: project.id,
            role: 'PROJECT_ADMIN',
          },
        });
      }

      return tx.project.findUniqueOrThrow({
        where: { id: project.id },
        include: {
          branches: true,
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
    });

    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.PROJECT_CREATE,
      targetType: 'Project',
      targetId: project.id,
      metadata: {
        projectKey: project.key,
        projectName: project.name,
        organizationId: project.organizationId,
      },
    });

    return project;
  }

  async findAll(language?: string) {
    return this.prisma.project.findMany({
      where: language ? { languages: { has: language } } : undefined,
      include: {
        branches: true,
        qualityGates: {
          include: { conditions: true },
        },
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByKey(key: string) {
    return this.prisma.project.findUnique({
      where: { key },
      include: {
        branches: true,
        qualityGates: {
          include: { conditions: true },
        },
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async getByKeyOrThrow(key: string) {
    const project = await this.findByKey(key);
    if (!project) {
      throw new NotFoundException(`Project with key "${key}" not found`);
    }
    return project;
  }

  async ensureActiveRuleProfile(projectId: string) {
    const project = (await (this.prisma as any).project.findUnique({
      where: { id: projectId },
      select: { id: true, activeRuleProfileId: true },
    })) as { id: string; activeRuleProfileId: string | null } | null;
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (project.activeRuleProfileId) {
      return (this.prisma as any).ruleProfile.findUnique({
        where: { id: project.activeRuleProfileId },
      });
    }

    const profile = await this.prisma.$transaction(async (tx) => {
      const existing = await (tx as any).ruleProfile.findFirst({
        where: { projectId: project.id, name: 'Default' },
      });
      const ruleProfileId = existing?.id ?? randomUUID();
      if (!existing) {
        await (tx as any).ruleProfile.create({
          data: {
            id: ruleProfileId,
            name: 'Default',
            projectId: project.id,
          },
        });
      }
      await tx.project.update({
        where: { id: project.id },
        data: { activeRuleProfileId: ruleProfileId } as any,
      });
      return (tx as any).ruleProfile.findUnique({ where: { id: ruleProfileId } });
    });

    return profile;
  }

  async getActiveRuleProfileByProjectKey(projectKey: string) {
    const project = await this.getByKeyOrThrow(projectKey);
    return this.ensureActiveRuleProfile(project.id);
  }

  async listRulesWithEnabledState(projectKey: string, query?: { analyzerKey?: string }) {
    const project = await this.getByKeyOrThrow(projectKey);
    const profile = await this.ensureActiveRuleProfile(project.id);
    const rules = await (this.prisma as any).rule.findMany({
      where: {
        ...(query?.analyzerKey ? { analyzerKey: query.analyzerKey } : {}),
      },
      orderBy: [{ analyzerKey: 'asc' }, { key: 'asc' }],
    });

    if (!rules?.length) {
      return { profile, rules: [] };
    }

    const overrides = await (this.prisma as any).ruleProfileRule.findMany({
      where: {
        ruleProfileId: profile.id,
        ruleKey: { in: rules.map((r: any) => r.key) },
      },
    });

    const enabledByRuleKey = new Map<string, boolean>(overrides.map((o: any) => [o.ruleKey, o.enabled]));

    return {
      profile,
      rules: rules.map((r: any) => ({
        ...r,
        enabled: enabledByRuleKey.get(r.key) ?? true,
      })),
    };
  }

  async updateActiveRuleProfileRules(projectKey: string, dto: UpdateRuleProfileRulesDto) {
    const project = await this.getByKeyOrThrow(projectKey);
    const profile = await this.ensureActiveRuleProfile(project.id);

    const uniqueKeys = Array.from(new Set((dto.rules ?? []).map((r) => r.ruleKey)));
    if (!uniqueKeys.length) {
      return { profile, updated: 0 };
    }

    const existingRules = await (this.prisma as any).rule.findMany({
      where: { key: { in: uniqueKeys } },
      select: { key: true },
    });
    const existingKeySet = new Set<string>(existingRules.map((r: any) => r.key));
    const missing = uniqueKeys.filter((k) => !existingKeySet.has(k));
    if (missing.length) {
      throw new BadRequestException(`Règles inconnues: ${missing.join(', ')}`);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const toggle of dto.rules) {
        await (tx as any).ruleProfileRule.upsert({
          where: {
            ruleProfileId_ruleKey: { ruleProfileId: profile.id, ruleKey: toggle.ruleKey },
          },
          update: { enabled: toggle.enabled },
          create: { ruleProfileId: profile.id, ruleKey: toggle.ruleKey, enabled: toggle.enabled },
        });
      }
    });

    return { profile, updated: dto.rules.length };
  }

  async listRuleProfiles(projectKey: string) {
    const project = (await (this.prisma as any).project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true, activeRuleProfileId: true },
    })) as { id: string; key: string; activeRuleProfileId: string | null } | null;
    if (!project) {
      throw new NotFoundException(`Project with key "${projectKey}" not found`);
    }

    const profiles = await (this.prisma as any).ruleProfile.findMany({
      where: { projectId: project.id },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    });

    return { activeRuleProfileId: project.activeRuleProfileId, profiles };
  }

  async createRuleProfile(projectKey: string, dto: CreateRuleProfileDto) {
    const project = await this.getByKeyOrThrow(projectKey);
    const id = randomUUID();
    try {
      return await (this.prisma as any).ruleProfile.create({
        data: { id, name: dto.name, projectId: project.id },
      });
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Impossible de créer le profil');
    }
  }

  async activateRuleProfile(projectKey: string, ruleProfileId: string) {
    const project = await this.getByKeyOrThrow(projectKey);
    const profile = await (this.prisma as any).ruleProfile.findUnique({
      where: { id: ruleProfileId },
      select: { id: true, projectId: true },
    });
    if (!profile || profile.projectId !== project.id) {
      throw new NotFoundException('RuleProfile not found for this project');
    }

    await this.prisma.project.update({
      where: { id: project.id },
      data: { activeRuleProfileId: ruleProfileId } as any,
    });

    return this.ensureActiveRuleProfile(project.id);
  }

  async createRule(dto: CreateRuleDto) {
    try {
      return await (this.prisma as any).rule.create({
        data: {
          key: dto.key,
          analyzerKey: dto.analyzerKey,
          name: dto.name,
          description: dto.description,
          defaultSeverity: dto.defaultSeverity,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new BadRequestException('Une règle avec cette clé existe déjà');
      }
      throw new BadRequestException(err?.message ?? 'Impossible de créer la règle');
    }
  }

  async listRules(analyzerKey?: string) {
    const where = analyzerKey ? { analyzerKey } : {};
    return await (this.prisma as any).rule.findMany({
      where,
      orderBy: [{ analyzerKey: 'asc' }, { name: 'asc' }],
    });
  }

  async getSettings(key: string) {
    const project = await this.prisma.project.findUnique({
      where: { key },
      select: {
        id: true,
        key: true,
        leakPeriodType: true,
        leakPeriodValue: true,
      },
    });
    if (!project) {
      throw new NotFoundException(`Project with key "${key}" not found`);
    }
    return project;
  }

  async updateSettings(
    key: string,
    settings: { leakPeriodType: LeakPeriodType; leakPeriodValue?: string | null },
    userId?: string,
  ) {
    const project = await this.getSettings(key);

    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        leakPeriodType: settings.leakPeriodType,
        leakPeriodValue: settings.leakPeriodValue ?? null,
      },
      select: {
        id: true,
        key: true,
        leakPeriodType: true,
        leakPeriodValue: true,
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.PROJECT_UPDATE,
      targetType: 'Project',
      targetId: project.id,
      metadata: {
        projectKey: project.key,
        changedFields: ['leakPeriodType', 'leakPeriodValue'],
      },
    });

    return updated;
  }

  async getMetrics(key: string, query: ProjectMetricsQueryDto) {
    const project = await this.findByKey(key);
    if (!project) {
      throw new NotFoundException(`Project with key "${key}" not found`);
    }

    const branchFilter = query.branch
      ? await this.prisma.branch.findFirst({
          where: { projectId: project.id, name: query.branch },
          select: { id: true },
        })
      : null;

    const limit = query.limit && query.limit > 0 ? query.limit : 50;

    const metrics = await this.prisma.analysisMetric.findMany({
      where: {
        projectId: project.id,
        ...(query.metricKey ? { metricKey: query.metricKey } : {}),
        ...(branchFilter ? { branchId: branchFilter.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        createdAt: true,
        value: true,
        metricKey: true,
        branchId: true,
        analysisId: true,
      },
    });

    // Retourner en ordre chronologique ascendant pour les graphes
    return metrics.reverse();
  }

  async detectLanguages(key: string, customPath?: string, saveToProject = false) {
    const project = await this.getByKeyOrThrow(key);

    // Si un chemin custom est fourni, faire une détection manuelle
    if (customPath) {
      const languages = await this.languageDetectionService.detectLanguages(customPath);
      const totalFiles = languages.reduce((sum, lang) => sum + lang.fileCount, 0);

      // Sauvegarder si demandé
      if (saveToProject && languages.length > 0) {
        const languageNames = languages.map((l) => l.language);
        await this.prisma.project.update({
          where: { id: project.id },
          data: { languages: languageNames },
        });
      }

      return {
        languages,
        totalFiles,
        projectPath: customPath,
      };
    }

    // Sinon, utiliser les langages stockés (détectés automatiquement pendant l'analyse)
    if (!project.languages || project.languages.length === 0) {
      throw new BadRequestException(
        'No languages detected yet. Please run an analysis first, or provide a custom path for manual detection.',
      );
    }

    // Mapper les langages stockés vers le format de réponse attendu
    const languages = project.languages.map((language) => {
      // Récupérer les analyseurs suggérés depuis le service
      const suggestedAnalyzers = this.getSuggestedAnalyzersForLanguage(language);

      return {
        language,
        confidence: 100, // Les langages stockés sont confirmés
        fileCount: 0, // Pas de compte de fichiers pour les langages stockés
        suggestedAnalyzers,
        frameworks: [], // Pas de frameworks détectés dans la version stockée
      };
    });

    return {
      languages,
      totalFiles: 0, // Pas de compte total pour les langages stockés
      projectPath: 'stored', // Indiquer que ce sont des langages stockés
    };
  }

  private getSuggestedAnalyzersForLanguage(language: string): string[] {
    // Analyseurs spécifiques par langage
    const languageSpecificMapping: Record<string, string[]> = {
      'JavaScript/TypeScript': ['eslint', 'semgrep'],
      Python: ['pylint', 'bandit', 'semgrep'],
      Java: ['spotbugs', 'pmd', 'semgrep'],
      Go: ['golangci-lint', 'semgrep'],
      PHP: ['phpstan', 'psalm', 'semgrep'],
      Rust: ['clippy', 'semgrep'],
      'C#': ['roslyn-analyzers', 'semgrep'],
      Ruby: ['rubocop', 'brakeman', 'semgrep'],
      Swift: ['swiftlint'],
      Kotlin: ['detekt'],
    };

    // Analyseurs transversaux (pertinents pour tous les langages)
    const universalAnalyzers = ['complexity', 'jscpd', 'trivy'];

    const languageSpecific = languageSpecificMapping[language] || [];

    // Combiner les analyseurs spécifiques et universels (sans doublons)
    return [...new Set([...languageSpecific, ...universalAnalyzers])];
  }

  async getSmtpConfig(key: string) {
    const project = await this.getByKeyOrThrow(key);
    return {
      smtpHost: project.smtpHost,
      smtpPort: project.smtpPort,
      smtpSecure: project.smtpSecure,
      smtpUser: project.smtpUser,
      smtpFrom: project.smtpFrom,
      // Ne pas retourner le mot de passe
    };
  }

  async updateSmtpConfig(key: string, dto: UpdateSmtpConfigDto, userId?: string) {
    const project = await this.getByKeyOrThrow(key);

    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpSecure: dto.smtpSecure,
        smtpUser: dto.smtpUser,
        smtpPassword: dto.smtpPassword,
        smtpFrom: dto.smtpFrom,
      },
    });

    // Audit log
    if (userId) {
      await this.auditService.log({
        actorUserId: userId,
        action: AuditAction.PROJECT_UPDATE,
        targetType: 'project',
        targetId: project.id,
        metadata: { description: `Updated SMTP configuration for project ${key}` },
      });
    }

    return {
      smtpHost: updated.smtpHost,
      smtpPort: updated.smtpPort,
      smtpSecure: updated.smtpSecure,
      smtpUser: updated.smtpUser,
      smtpFrom: updated.smtpFrom,
    };
  }

  async getLlmSettings(key: string) {
    const project = await this.getByKeyOrThrow(key);

    const [settings, providers] = await Promise.all([
      this.prisma.projectLlmSettings.findUnique({
        where: { projectId: project.id },
        include: { llmProvider: true },
      }) as Promise<{ llmProviderId: string | null; overridesJson: Prisma.JsonValue | null; llmProvider: LlmProvider | null } | null>,
      this.prisma.llmProvider.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const providersSummary = providers.map((provider) => this.toLlmProviderSummary(provider));
    const providerFromSettings = settings?.llmProvider ?? null;
    const defaultProvider = providers.find((provider) => provider.isDefault) ?? null;

    const effectiveProvider = providerFromSettings ?? defaultProvider ?? null;
    const source = providerFromSettings ? 'project' : effectiveProvider ? 'default' : 'none';

    return {
      projectKey: project.key,
      provider: effectiveProvider ? this.toLlmProviderSummary(effectiveProvider) : null,
      selectedProviderId: settings?.llmProviderId ?? null,
      overrides: settings?.overridesJson ?? null,
      source,
      providers: providersSummary,
    };
  }

  async updateLlmSettings(key: string, dto: UpdateProjectLlmSettingsDto, userId?: string) {
    const project = await this.getByKeyOrThrow(key);

    const hasProvider = dto.llmProviderId !== undefined;
    const hasOverrides = dto.overrides !== undefined;

    if (!hasProvider && !hasOverrides) {
      return this.getLlmSettings(key);
    }

    let providerId: string | null | undefined = dto.llmProviderId;
    if (hasProvider && providerId) {
      const provider = await this.prisma.llmProvider.findUnique({ where: { id: providerId } });
      if (!provider) {
        throw new NotFoundException(`LLM provider with id "${providerId}" not found`);
      }
    }

    const overridesPayload = hasOverrides ? this.buildLlmOverrides(dto.overrides) : undefined;

    const updateData: Prisma.ProjectLlmSettingsUncheckedUpdateInput = {};
    const createData: Prisma.ProjectLlmSettingsUncheckedCreateInput = {
      projectId: project.id,
      llmProviderId: null,
      overridesJson: Prisma.JsonNull,
    };

    if (hasProvider) {
      updateData.llmProviderId = providerId ?? null;
      createData.llmProviderId = providerId ?? null;
    }

    if (hasOverrides) {
      updateData.overridesJson = overridesPayload ? overridesPayload : Prisma.JsonNull;
      createData.overridesJson = overridesPayload ? overridesPayload : Prisma.JsonNull;
    }

    await this.prisma.projectLlmSettings.upsert({
      where: { projectId: project.id },
      update: updateData,
      create: createData,
    });

    if (userId) {
      await this.auditService.log({
        actorUserId: userId,
        action: AuditAction.PROJECT_UPDATE,
        targetType: 'Project',
        targetId: project.id,
        metadata: {
          projectKey: project.key,
          changedFields: [
            ...(hasProvider ? ['llmProviderId'] : []),
            ...(hasOverrides ? ['overridesJson'] : []),
          ],
        },
      });
    }

    return this.getLlmSettings(key);
  }

  private buildLlmOverrides(overrides?: LlmOverridesDto | null) {
    if (!overrides) return null;
    const payload: Record<string, number> = {};
    if (overrides.temperature !== undefined) payload.temperature = overrides.temperature;
    if (overrides.topP !== undefined) payload.topP = overrides.topP;
    if (overrides.maxTokens !== undefined) payload.maxTokens = overrides.maxTokens;
    return Object.keys(payload).length ? payload : null;
  }

  private toLlmProviderSummary(provider: LlmProvider) {
    return {
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      model: provider.model,
      isDefault: provider.isDefault,
    };
  }
}
