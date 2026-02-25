import { LeakPeriodType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ProjectSettingsDto {
  @ApiProperty({ enum: LeakPeriodType, example: LeakPeriodType.LAST_ANALYSIS })
  @IsEnum(LeakPeriodType)
  leakPeriodType!: LeakPeriodType;

  @ApiProperty({
    required: false,
    description: 'Date ISO si type=DATE, branche de référence si type=BASE_BRANCH, null sinon',
    example: 'main',
  })
  @IsString()
  @IsOptional()
  leakPeriodValue?: string | null;
}
