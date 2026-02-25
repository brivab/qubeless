import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateApiTokenDto {
  @ApiProperty({ example: 'CI token' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'project-key' })
  @IsString()
  @IsOptional()
  projectKey?: string;
}
