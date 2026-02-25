import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ProjectMetricsQueryDto {
  @ApiPropertyOptional({ description: 'Branche cible pour filtrer les métriques' })
  @IsString()
  @IsOptional()
  branch?: string;

  @ApiPropertyOptional({ description: 'Clé de métrique (ex: issues_total, issues_new_critical)' })
  @IsString()
  @IsOptional()
  metricKey?: string;

  @ApiPropertyOptional({ description: 'Nombre maximal de points', default: 50 })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsOptional()
  limit?: number;
}
