import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAnalyzerDto {
  @ApiProperty({ example: 'semgrep' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: 'Semgrep Analyzer' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'ghcr.io/org/analyzers/semgrep:0.1.0' })
  @IsString()
  @IsNotEmpty()
  dockerImage!: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
