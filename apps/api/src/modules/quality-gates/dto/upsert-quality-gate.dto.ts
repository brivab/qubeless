import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQualityGateConditionDto } from './create-quality-gate-condition.dto';

export class UpsertQualityGateDto {
  @ApiProperty({ example: 'Default' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ type: [CreateQualityGateConditionDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateQualityGateConditionDto)
  conditions?: CreateQualityGateConditionDto[];
}
