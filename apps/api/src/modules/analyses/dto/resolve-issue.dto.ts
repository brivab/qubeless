import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum IssueStatus {
  OPEN = 'OPEN',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  ACCEPTED_RISK = 'ACCEPTED_RISK',
  RESOLVED = 'RESOLVED',
}

export class ResolveIssueDto {
  @ApiProperty({ enum: IssueStatus, example: 'FALSE_POSITIVE' })
  @IsEnum(IssueStatus)
  @IsNotEmpty()
  status!: IssueStatus;

  @ApiProperty({ example: 'This is a test file, not production code', required: false })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsString()
  @IsNotEmpty()
  author!: string;
}
