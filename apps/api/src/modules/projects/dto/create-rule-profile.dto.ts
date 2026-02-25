import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateRuleProfileDto {
  @ApiProperty({ example: 'Backend' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

