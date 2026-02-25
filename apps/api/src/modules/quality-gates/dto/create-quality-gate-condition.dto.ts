import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QualityGateOperator, QualityGateScope } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateQualityGateConditionDto {
  @ApiProperty({ example: 'blocker_issues' })
  @IsString()
  @IsNotEmpty()
  metric!: string;

  @ApiProperty({ enum: QualityGateOperator, example: QualityGateOperator.GT })
  @IsEnum(QualityGateOperator)
  operator!: QualityGateOperator;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Type(() => Number)
  threshold!: number;

  @ApiPropertyOptional({ enum: QualityGateScope, example: QualityGateScope.ALL, default: QualityGateScope.ALL })
  @IsEnum(QualityGateScope)
  @IsOptional()
  scope?: QualityGateScope = QualityGateScope.ALL;
}
