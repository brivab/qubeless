import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QualityGatesService } from './quality-gates.service';
import { CreateQualityGateDto } from './dto/create-quality-gate.dto';
import { CreateQualityGateConditionDto } from './dto/create-quality-gate-condition.dto';
import { UpsertQualityGateDto } from './dto/upsert-quality-gate.dto';
import { ApiOrJwtGuard } from '../auth/guards/api-or-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@ApiTags('quality-gates')
@ApiBearerAuth()
@Controller()
@UseGuards(ApiOrJwtGuard)
export class QualityGatesController {
  constructor(private readonly qualityGatesService: QualityGatesService) {}

  @Post('projects/:key/quality-gate')
  @ApiOperation({ summary: 'Créer/Maj Quality Gate', description: 'Crée un Quality Gate pour le projet.' })
  createForProject(@Param('key') key: string, @Body() dto: CreateQualityGateDto) {
    return this.qualityGatesService.createForProject(key, dto);
  }

  @Put('projects/:key/quality-gate')
  @ApiOperation({ summary: 'Créer/Maj Quality Gate (conditions)', description: 'Crée ou met à jour le Quality Gate et ses conditions.' })
  upsertForProject(@Param('key') key: string, @Body() dto: UpsertQualityGateDto, @CurrentUser() user?: AuthPayload) {
    return this.qualityGatesService.upsertForProject(key, dto, user?.sub);
  }

  @Get('projects/:key/quality-gate')
  @ApiOperation({ summary: 'Récupérer le Quality Gate du projet' })
  findForProject(@Param('key') key: string) {
    return this.qualityGatesService.findForProject(key);
  }

  @Post('quality-gates/:id/conditions')
  @ApiOperation({ summary: 'Ajouter une condition' })
  addCondition(@Param('id') id: string, @Body() dto: CreateQualityGateConditionDto) {
    return this.qualityGatesService.addCondition(id, dto);
  }
}
