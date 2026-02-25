import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { OrgRoles } from './decorators/org-roles.decorator';
import { OrganizationMembershipGuard } from './guards/organization-membership.guard';
import { OrgRole } from '@prisma/client';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthPayload,
  ) {
    return this.orgsService.create(dto, user.sub);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthPayload) {
    return this.orgsService.findAll(user.sub, user.role);
  }

  @Get(':slug')
  @UseGuards(OrganizationMembershipGuard)
  async findOne(@Param('slug') slug: string) {
    return this.orgsService.findBySlug(slug);
  }

  @Put(':slug')
  @UseGuards(OrganizationMembershipGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthPayload,
  ) {
    return this.orgsService.update(slug, dto, user.sub);
  }

  @Delete(':slug')
  @UseGuards(OrganizationMembershipGuard)
  @OrgRoles(OrgRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthPayload,
  ) {
    await this.orgsService.delete(slug, user.sub);
  }

  @Get(':slug/members')
  @UseGuards(OrganizationMembershipGuard)
  async getMembers(@Param('slug') slug: string) {
    return this.orgsService.getMembers(slug);
  }

  @Post(':slug/members')
  @UseGuards(OrganizationMembershipGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  async addMember(
    @Param('slug') slug: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthPayload,
  ) {
    return this.orgsService.addMember(slug, dto.email, dto.role, user.sub);
  }

  @Delete(':slug/members/:userId')
  @UseGuards(OrganizationMembershipGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthPayload,
  ) {
    await this.orgsService.removeMember(slug, userId, user.sub);
  }

  @Get(':slug/projects')
  @UseGuards(OrganizationMembershipGuard)
  async getProjects(@Param('slug') slug: string) {
    return this.orgsService.getProjects(slug);
  }
}
