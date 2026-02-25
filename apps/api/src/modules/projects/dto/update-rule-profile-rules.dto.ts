import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RuleToggleDto {
  @ApiProperty({ example: 'js:S100' })
  @IsString()
  @IsNotEmpty()
  ruleKey!: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateRuleProfileRulesDto {
  @ApiProperty({ type: [RuleToggleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleToggleDto)
  rules!: RuleToggleDto[];
}

