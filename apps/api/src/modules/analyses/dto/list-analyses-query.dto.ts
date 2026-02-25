import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListAnalysesQueryDto {
  @ApiPropertyOptional({ description: 'Filtrer par nom de branche', example: 'main' })
  @IsString()
  @IsOptional()
  branch?: string;
}
