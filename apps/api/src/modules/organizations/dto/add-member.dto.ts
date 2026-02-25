import { IsEmail, IsEnum } from 'class-validator';
import { OrgRole } from '@prisma/client';

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrgRole)
  role!: OrgRole;
}
