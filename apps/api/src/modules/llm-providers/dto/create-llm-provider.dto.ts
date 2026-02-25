import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateLlmProviderDto {
  @ApiProperty({ example: 'OpenAI' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'openai' })
  @IsString()
  @IsNotEmpty()
  providerType!: string;

  @ApiProperty({ example: 'https://api.openai.com/v1/models' })
  @IsString()
  @IsNotEmpty()
  baseUrl!: string;

  @ApiPropertyOptional({ example: 'gpt-4o-mini' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ type: Object, example: { 'X-Custom-Header': 'value' } })
  @IsObject()
  @IsOptional()
  headersJson?: Record<string, string>;

  @ApiPropertyOptional({ example: 'sk-***' })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
