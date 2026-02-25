import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthorizationService } from './authorization.service';
import { ProjectMembershipGuard } from './guards/project-membership.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [AuthorizationService, ProjectMembershipGuard],
  exports: [AuthorizationService, ProjectMembershipGuard],
})
export class AuthorizationModule {}
