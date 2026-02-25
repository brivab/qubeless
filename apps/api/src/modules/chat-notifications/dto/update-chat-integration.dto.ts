import { IsString, IsArray, IsBoolean, IsOptional, IsIn, IsUrl } from 'class-validator';

export class UpdateChatIntegrationDto {
  @IsOptional()
  @IsString()
  @IsUrl()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['analysis.completed', 'quality_gate.failed'], { each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
