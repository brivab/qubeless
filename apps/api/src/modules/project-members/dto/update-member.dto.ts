import { IsEnum } from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class UpdateMemberDto {
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
