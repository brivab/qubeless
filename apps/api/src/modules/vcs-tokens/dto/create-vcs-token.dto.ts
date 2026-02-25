import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PullRequestProvider } from '@prisma/client';

export class CreateVcsTokenDto {
  @ApiProperty({ enum: PullRequestProvider, example: PullRequestProvider.GITHUB })
  @IsEnum(PullRequestProvider)
  provider!: PullRequestProvider;

  @ApiProperty({ example: 'ghp_xxx' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'https://gitlab.example.com', required: false })
  @IsString()
  @IsOptional()
  baseUrl?: string;
}
