import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LdapLoginDto {
  @ApiProperty({ example: 'jdoe' })
  @IsString()
  username!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  mfaCode?: string;
}
