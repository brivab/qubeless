import { IsEmail, IsEnum } from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class CreateMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
