import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { LoginRequest } from '@qubeless/shared';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'admin123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  mfaCode?: string;
}
