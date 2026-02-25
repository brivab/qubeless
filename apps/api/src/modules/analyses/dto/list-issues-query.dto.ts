import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssueSeverity, IssueType, IssueStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListIssuesQueryDto {
  @ApiPropertyOptional({ enum: IssueSeverity })
  @IsEnum(IssueSeverity)
  @IsOptional()
  severity?: IssueSeverity;

  @ApiPropertyOptional({ enum: IssueType })
  @IsEnum(IssueType)
  @IsOptional()
  type?: IssueType;

  @ApiPropertyOptional({ enum: IssueStatus, description: 'Filtre sur le statut (OPEN, FALSE_POSITIVE, ACCEPTED_RISK, RESOLVED)' })
  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus;

  @ApiPropertyOptional({ description: 'Filtre sur le chemin de fichier' })
  @IsString()
  @IsOptional()
  filePath?: string;

  @ApiPropertyOptional({ description: 'Filtre sur le langage (ex: JavaScript/TypeScript, Python, Java)' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: 'Filtrer uniquement les issues nouvelles (scope=NEW ou onlyNew=true)', enum: ['NEW', 'ALL'] })
  @IsOptional()
  scope?: 'NEW' | 'ALL';

  @ApiPropertyOptional({ description: 'Filtrer uniquement les issues nouvelles (déprécié, utiliser scope)' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  onlyNew?: boolean;
}
