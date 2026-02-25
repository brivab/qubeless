import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateProjectAnalyzerDto {
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Configuration JSON libre pour cet analyzer' })
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configJson?: any;
}
