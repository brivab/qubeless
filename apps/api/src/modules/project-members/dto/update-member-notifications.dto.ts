import { IsBoolean, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberNotificationsDto {
  @ApiProperty({
    description: 'Enable email notifications for failed analyses',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  emailNotifyAnalysisFailed?: boolean;

  @ApiProperty({
    description: 'Enable email notifications for failed quality gates',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  emailNotifyQualityGateFailed?: boolean;

  @ApiProperty({
    description: 'Custom email address for this project (overrides user account email)',
    example: 'custom@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  emailAddress?: string | null;
}
