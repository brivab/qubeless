import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateLlmProviderDto {
  @ApiPropertyOptional({ example: 'OpenAI' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'openai' })
  @IsString()
  @IsOptional()
  providerType?: string;

  @ApiPropertyOptional({ example: 'https://api.openai.com/v1/models' })
  @IsString()
  @IsOptional()
  baseUrl?: string;

  @ApiPropertyOptional({ example: 'gpt-4o-mini' })
  @IsString()
  @IsOptional()
  model?: string | null;

  @ApiPropertyOptional({ type: Object, example: { 'X-Custom-Header': 'value' } })
  @IsObject()
  @IsOptional()
  headersJson?: Record<string, string> | null;

  @ApiPropertyOptional({ example: 'sk-***', description: 'Provide to update, empty string to clear.' })
  @IsString()
  @IsOptional()
  token?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
