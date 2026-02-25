import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'my-project-key' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: 'My Project' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Description of the project' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  organizationId!: string;
}
