import { ApiProperty } from '@nestjs/swagger';

export class PortfolioSummaryDto {
  @ApiProperty({ description: 'Nombre total de projets' })
  totalProjects!: number;

  @ApiProperty({ description: 'Nombre total d\'analyses' })
  totalAnalyses!: number;

  @ApiProperty({ description: 'Nombre total d\'issues' })
  totalIssues!: number;

  @ApiProperty({ description: 'Couverture moyenne (%)' })
  avgCoverage!: number;

  @ApiProperty({ description: 'Ratio de dette moyen (%)' })
  avgDebtRatio!: number;
}

export class PortfolioProjectAnalysisDto {
  @ApiProperty({ description: 'Statut du quality gate' })
  qualityGateStatus!: string;

  @ApiProperty({ description: 'Nombre d\'issues' })
  issuesCount!: number;

  @ApiProperty({ description: 'Couverture (%)' })
  coverage!: number | null;

  @ApiProperty({ description: 'Ratio de dette (%)' })
  debtRatio!: number | null;

  @ApiProperty({ description: 'Date de création' })
  createdAt!: Date;

  @ApiProperty({ description: 'ID de l\'analyse' })
  id!: string;

  @ApiProperty({ description: 'Statut de l\'analyse' })
  status!: string;
}

export class PortfolioProjectDto {
  @ApiProperty({ description: 'ID du projet' })
  id!: string;

  @ApiProperty({ description: 'Clé du projet' })
  key!: string;

  @ApiProperty({ description: 'Nom du projet' })
  name!: string;

  @ApiProperty({ description: 'Description du projet', required: false })
  description?: string | null;

  @ApiProperty({ description: 'ID de l\'organisation' })
  organizationId!: string;

  @ApiProperty({ description: 'Nom de l\'organisation' })
  organizationName!: string;

  @ApiProperty({ description: 'Dernière analyse', required: false, type: PortfolioProjectAnalysisDto })
  lastAnalysis?: PortfolioProjectAnalysisDto | null;
}

export class PortfolioResponseDto {
  @ApiProperty({ description: 'Résumé du portfolio', type: PortfolioSummaryDto })
  summary!: PortfolioSummaryDto;

  @ApiProperty({ description: 'Liste des projets', type: [PortfolioProjectDto] })
  projects!: PortfolioProjectDto[];

  @ApiProperty({ description: 'Nombre total de projets (avant pagination)' })
  total!: number;
}
