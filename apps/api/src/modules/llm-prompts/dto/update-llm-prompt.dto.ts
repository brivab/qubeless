import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateLlmPromptDto {
  @ApiPropertyOptional({ example: 'issue-fix' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'v2' })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({ example: 'You are a senior engineer...' })
  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @ApiPropertyOptional({ example: 'Fix the issue described. Return ONLY JSON.' })
  @IsString()
  @IsOptional()
  taskPrompt?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
