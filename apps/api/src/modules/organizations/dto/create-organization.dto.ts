import { IsString, IsOptional, Matches, MinLength, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  @MinLength(3)
  @MaxLength(50)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
