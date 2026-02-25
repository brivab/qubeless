import { IsString, IsArray, IsBoolean, IsOptional, IsIn, IsUrl, ArrayMinSize } from 'class-validator';

export class CreateChatIntegrationDto {
  @IsString()
  @IsIn(['slack', 'teams', 'discord', 'generic', 'mattermost', 'rocketchat', 'googlechat'])
  provider!: string;

  @IsString()
  @IsUrl()
  webhookUrl!: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(['analysis.completed', 'quality_gate.failed'], { each: true })
  events!: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
