import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLlmPromptDto {
  @ApiProperty({ example: 'issue-fix' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'v1' })
  @IsString()
  @IsNotEmpty()
  version!: string;

  @ApiProperty({ example: 'You are a senior engineer...' })
  @IsString()
  @IsNotEmpty()
  systemPrompt!: string;

  @ApiProperty({ example: 'Fix the issue described. Return ONLY JSON.' })
  @IsString()
  @IsNotEmpty()
  taskPrompt!: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
