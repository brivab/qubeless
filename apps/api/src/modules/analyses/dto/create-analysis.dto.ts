import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PullRequestProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAnalysisDto {
  @ApiProperty({ example: '9fceb02d0ae598e95dc970b74767f19372d61af8' })
  @IsString()
  @IsNotEmpty()
  commitSha!: string;

  @ApiPropertyOptional({ example: 'main' })
  @IsString()
  @IsOptional()
  branch?: string;

  @ApiPropertyOptional({ example: 'GITHUB', enum: PullRequestProvider })
  @IsEnum(PullRequestProvider)
  @IsOptional()
  provider?: PullRequestProvider;

  @ApiPropertyOptional({ example: 'org/repo' })
  @IsString()
  @IsOptional()
  repo?: string;

  @ApiPropertyOptional({ example: 42 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  prNumber?: number;

  @ApiPropertyOptional({ example: 'feature/branch' })
  @IsString()
  @IsOptional()
  sourceBranch?: string;

  @ApiPropertyOptional({ example: 'main' })
  @IsString()
  @IsOptional()
  targetBranch?: string;

  @ApiPropertyOptional({
    example: ['uuid-1', 'uuid-2'],
    description: 'Liste optionnelle des IDs d\'analyzers à exécuter. Si non fourni, tous les analyzers actifs seront exécutés.',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  analyzerIds?: string[];
}
