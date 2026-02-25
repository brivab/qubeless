import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateVcsTokenDto {
  @ApiPropertyOptional({ example: 'ghp_xxx' })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({ example: 'https://gitlab.example.com' })
  @IsString()
  @IsOptional()
  baseUrl?: string;
}
