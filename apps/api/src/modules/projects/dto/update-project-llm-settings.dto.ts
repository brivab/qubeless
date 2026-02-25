import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LlmOverridesDto {
  @ApiPropertyOptional({ example: 0.2, description: 'Sampling temperature (0-2)' })
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  @Type(() => Number)
  temperature?: number;

  @ApiPropertyOptional({ example: 0.9, description: 'Nucleus sampling cutoff (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  @Type(() => Number)
  topP?: number;

  @ApiPropertyOptional({ example: 2048, description: 'Maximum output tokens (1-200000)' })
  @IsInt()
  @Min(1)
  @Max(200000)
  @IsOptional()
  @Type(() => Number)
  maxTokens?: number;
}

export class UpdateProjectLlmSettingsDto {
  @ApiPropertyOptional({ example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  @IsOptional()
  llmProviderId?: string | null;

  @ApiPropertyOptional({ type: LlmOverridesDto })
  @ValidateNested()
  @Type(() => LlmOverridesDto)
  @IsOptional()
  overrides?: LlmOverridesDto | null;
}
