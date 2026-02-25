import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { IssueSeverity } from '@prisma/client';

export class CreateRuleDto {
  @ApiProperty({ example: 'custom:no-console' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: 'custom' })
  @IsString()
  @IsNotEmpty()
  analyzerKey!: string;

  @ApiProperty({ example: 'No console.log allowed' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Console statements should not be used in production code' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ enum: IssueSeverity, example: 'MAJOR' })
  @IsEnum(IssueSeverity)
  defaultSeverity!: IssueSeverity;
}
