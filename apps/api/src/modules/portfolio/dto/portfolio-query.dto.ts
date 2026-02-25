import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum QualityGateStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}

export enum PortfolioSortBy {
  NAME = 'name',
  ISSUES = 'issues',
  COVERAGE = 'coverage',
  DEBT = 'debt',
  LAST_ANALYSIS = 'lastAnalysis',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class PortfolioQueryDto {
  @ApiPropertyOptional({ description: 'Filtrer par organisation' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par statut du quality gate',
    enum: QualityGateStatus
  })
  @IsEnum(QualityGateStatus)
  @IsOptional()
  qualityGateStatus?: QualityGateStatus;

  @ApiPropertyOptional({
    description: 'Couverture minimale (%)',
    minimum: 0,
    maximum: 100
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  minCoverage?: number;

  @ApiPropertyOptional({
    description: 'Couverture maximale (%)',
    minimum: 0,
    maximum: 100
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  maxCoverage?: number;

  @ApiPropertyOptional({
    description: 'Ratio de dette minimale (%)',
    minimum: 0,
    maximum: 100
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  minDebtRatio?: number;

  @ApiPropertyOptional({
    description: 'Ratio de dette maximale (%)',
    minimum: 0,
    maximum: 100
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  maxDebtRatio?: number;

  @ApiPropertyOptional({
    description: 'Trier par',
    enum: PortfolioSortBy,
    default: PortfolioSortBy.NAME
  })
  @IsEnum(PortfolioSortBy)
  @IsOptional()
  sortBy?: PortfolioSortBy = PortfolioSortBy.NAME;

  @ApiPropertyOptional({
    description: 'Ordre de tri',
    enum: SortOrder,
    default: SortOrder.ASC
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.ASC;

  @ApiPropertyOptional({
    description: 'Nombre de résultats par page',
    minimum: 1,
    maximum: 100,
    default: 50
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Offset pour la pagination',
    minimum: 0,
    default: 0
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
