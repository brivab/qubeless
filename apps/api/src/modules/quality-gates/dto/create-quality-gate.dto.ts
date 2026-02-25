import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateQualityGateDto {
  @ApiProperty({ example: 'Default' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
