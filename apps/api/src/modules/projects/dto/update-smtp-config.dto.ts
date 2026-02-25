import { IsString, IsInt, IsBoolean, IsEmail, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSmtpConfigDto {
  @ApiProperty({
    description: 'SMTP server host',
    example: 'smtp.gmail.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  smtpHost?: string | null;

  @ApiProperty({
    description: 'SMTP server port',
    example: 587,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  smtpPort?: number | null;

  @ApiProperty({
    description: 'Use secure connection (TLS)',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  smtpSecure?: boolean | null;

  @ApiProperty({
    description: 'SMTP username',
    example: 'user@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  smtpUser?: string | null;

  @ApiProperty({
    description: 'SMTP password',
    example: 'password123',
    required: false,
  })
  @IsString()
  @IsOptional()
  smtpPassword?: string | null;

  @ApiProperty({
    description: 'From email address',
    example: 'noreply@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  smtpFrom?: string | null;
}
