import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMembershipGuard, ProjectRoles } from '../authorization';
import { ProjectRole } from '@prisma/client';
import { ProjectMembersService } from './project-members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateMemberNotificationsDto } from './dto/update-member-notifications.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('projects/:key/members')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  async getMembers(@Param('key') projectKey: string) {
    return this.membersService.getProjectMembers(projectKey);
  }

  @Post()
  @ProjectRoles(ProjectRole.PROJECT_ADMIN)
  async addMember(
    @Param('key') projectKey: string,
    @Body() dto: CreateMemberDto,
    @CurrentUser() user?: AuthPayload,
  ) {
    return this.membersService.addMember(projectKey, dto, user?.sub);
  }

  @Put(':memberId')
  @ProjectRoles(ProjectRole.PROJECT_ADMIN)
  async updateMember(
    @Param('key') projectKey: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user?: AuthPayload,
  ) {
    return this.membersService.updateMember(projectKey, memberId, dto, user?.sub);
  }

  @Delete(':memberId')
  @ProjectRoles(ProjectRole.PROJECT_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('key') projectKey: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user?: AuthPayload,
  ) {
    await this.membersService.removeMember(projectKey, memberId, user?.sub);
  }

  @Put('me/notifications')
  async updateMyNotifications(
    @Param('key') projectKey: string,
    @Body() dto: UpdateMemberNotificationsDto,
    @CurrentUser() user?: AuthPayload,
  ) {
    if (!user?.sub) {
      throw new Error('User not authenticated');
    }
    return this.membersService.updateMemberNotifications(
      projectKey,
      user.sub,
      dto,
    );
  }
}
