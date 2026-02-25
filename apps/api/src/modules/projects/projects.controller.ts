import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectSettingsDto } from './dto/project-settings.dto';
import { LeakPeriodType } from '@prisma/client';
import { ProjectMetricsQueryDto } from './dto/project-metrics-query.dto';
import { UpdateRuleProfileRulesDto } from './dto/update-rule-profile-rules.dto';
import { CreateRuleProfileDto } from './dto/create-rule-profile.dto';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateSmtpConfigDto } from './dto/update-smtp-config.dto';
import { UpdateProjectLlmSettingsDto } from './dto/update-project-llm-settings.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ProjectMembershipGuard, ProjectRoles } from '../authorization';
import { ProjectRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiOrJwtGuard } from '../auth/guards/api-or-jwt.guard';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(ApiOrJwtGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un projet', description: 'Crée un projet et sa branche par défaut (main).' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user?: AuthPayload) {
    return this.projectsService.create(dto, user?.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les projets' })
  @UseGuards(JwtAuthGuard)
  findAll(@Query('language') language?: string) {
    return this.projectsService.findAll(language);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Récupérer un projet par key' })
  @UseGuards(ProjectMembershipGuard)
  findOne(@Param('key') key: string) {
    return this.projectsService.getByKeyOrThrow(key);
  }

  @Get(':key/settings')
  @ApiOperation({ summary: 'Récupérer les réglages du projet (leak period)' })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  getSettings(@Param('key') key: string) {
    return this.projectsService.getSettings(key);
  }

  @Put(':key/settings')
  @ApiOperation({ summary: 'Mettre à jour les réglages du projet (leak period)' })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  async updateSettings(@Param('key') key: string, @Body() dto: ProjectSettingsDto, @CurrentUser() user?: AuthPayload) {
    const value =
      dto.leakPeriodType === LeakPeriodType.LAST_ANALYSIS ? null : dto.leakPeriodValue ?? null;

    if (dto.leakPeriodType === LeakPeriodType.DATE && value) {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('leakPeriodValue doit être une date ISO (YYYY-MM-DD)');
      }
    }
    if (dto.leakPeriodType === LeakPeriodType.BASE_BRANCH && !value) {
      throw new BadRequestException('leakPeriodValue (branche de référence) est requis pour BASE_BRANCH');
    }
    return this.projectsService.updateSettings(key, {
      leakPeriodType: dto.leakPeriodType,
      leakPeriodValue: value,
    }, user?.sub);
  }

  @Get(':key/metrics')
  @ApiOperation({ summary: 'Métriques du projet dans le temps', description: 'Filtre par branche et métrique.' })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  getMetrics(@Param('key') key: string, @Query() query: ProjectMetricsQueryDto) {
    return this.projectsService.getMetrics(key, query);
  }

  @Get(':key/rule-profile')
  @ApiOperation({ summary: 'Récupérer le profil de règles actif du projet' })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  getActiveRuleProfile(@Param('key') key: string) {
    return this.projectsService.getActiveRuleProfileByProjectKey(key);
  }

  @Get(':key/rules')
  @ApiOperation({ summary: 'Lister les règles connues + enabled pour le projet' })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  listRules(@Param('key') key: string, @Query('analyzerKey') analyzerKey?: string) {
    return this.projectsService.listRulesWithEnabledState(key, { analyzerKey });
  }

  @Put(':key/rules')
  @ApiOperation({ summary: 'Activer/désactiver des règles (profil actif)' })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  updateRules(@Param('key') key: string, @Body() dto: UpdateRuleProfileRulesDto) {
    return this.projectsService.updateActiveRuleProfileRules(key, dto);
  }

  @Get(':key/rule-profiles')
  @ApiOperation({ summary: 'Lister les profils de règles du projet' })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  listRuleProfiles(@Param('key') key: string) {
    return this.projectsService.listRuleProfiles(key);
  }

  @Post(':key/rule-profiles')
  @ApiOperation({ summary: 'Créer un profil de règles pour le projet' })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  createRuleProfile(@Param('key') key: string, @Body() dto: CreateRuleProfileDto) {
    return this.projectsService.createRuleProfile(key, dto);
  }

  @Put(':key/rule-profiles/:profileId/activate')
  @ApiOperation({ summary: 'Activer un profil de règles pour le projet' })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  activateRuleProfile(@Param('key') key: string, @Param('profileId') profileId: string) {
    return this.projectsService.activateRuleProfile(key, profileId);
  }

  @Post('rules')
  @ApiOperation({ summary: 'Créer une règle personnalisée' })
  @UseGuards(JwtAuthGuard)
  createRule(@Body() dto: CreateRuleDto) {
    return this.projectsService.createRule(dto);
  }

  @Get('rules')
  @ApiOperation({ summary: 'Lister toutes les règles' })
  @UseGuards(JwtAuthGuard)
  getAllRules(@Query('analyzerKey') analyzerKey?: string) {
    return this.projectsService.listRules(analyzerKey);
  }

  @Get(':key/detect-languages')
  @ApiOperation({
    summary: 'Détecter les langages utilisés dans le projet',
    description: 'Scanne le code source du projet pour détecter automatiquement les langages et suggérer les analyseurs appropriés.',
  })
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  detectLanguages(
    @Param('key') key: string,
    @Query('path') customPath?: string,
    @Query('save') saveToProject?: boolean,
  ) {
    return this.projectsService.detectLanguages(key, customPath, saveToProject);
  }

  @Get(':key/smtp-config')
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  @ProjectRoles(ProjectRole.PROJECT_ADMIN)
  @ApiOperation({ summary: 'Récupérer la configuration SMTP du projet' })
  getSmtpConfig(@Param('key') key: string) {
    return this.projectsService.getSmtpConfig(key);
  }

  @Get(':key/llm-settings')
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  @ProjectRoles(ProjectRole.PROJECT_ADMIN)
  @ApiOperation({ summary: 'Récupérer les réglages LLM du projet' })
  getLlmSettings(@Param('key') key: string) {
    return this.projectsService.getLlmSettings(key);
  }

  @Put(':key/smtp-config')
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  @ProjectRoles(ProjectRole.PROJECT_ADMIN)
  @ApiOperation({ summary: 'Mettre à jour la configuration SMTP du projet' })
  updateSmtpConfig(
    @Param('key') key: string,
    @Body() dto: UpdateSmtpConfigDto,
    @CurrentUser() user?: AuthPayload,
  ) {
    return this.projectsService.updateSmtpConfig(key, dto, user?.sub);
  }

  @Put(':key/llm-settings')
  @UseGuards(JwtAuthGuard, ProjectMembershipGuard)
  @ProjectRoles(ProjectRole.PROJECT_ADMIN)
  @ApiOperation({ summary: 'Mettre à jour les réglages LLM du projet' })
  updateLlmSettings(
    @Param('key') key: string,
    @Body() dto: UpdateProjectLlmSettingsDto,
    @CurrentUser() user?: AuthPayload,
  ) {
    return this.projectsService.updateLlmSettings(key, dto, user?.sub);
  }
}
