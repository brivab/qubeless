import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, HttpStatus, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChatNotificationsService } from './chat-notifications.service';
import { CreateChatIntegrationDto } from './dto/create-chat-integration.dto';
import { UpdateChatIntegrationDto } from './dto/update-chat-integration.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatIntegrationMembershipGuard } from './guards/chat-integration-membership.guard';

@ApiTags('chat-notifications')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ChatNotificationsController {
  constructor(
    private readonly chatNotificationsService: ChatNotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('projects/:key/chat-integrations')
  @ApiOperation({ summary: 'List all chat integrations for a project' })
  @UseGuards(ChatIntegrationMembershipGuard)
  async listForProject(@Param('key') projectKey: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectKey} not found`);
    }

    return this.chatNotificationsService.listForProject(project.id);
  }

  @Post('projects/:key/chat-integrations')
  @ApiOperation({ summary: 'Create a new chat integration' })
  @UseGuards(ChatIntegrationMembershipGuard)
  async create(@Param('key') projectKey: string, @Body() dto: CreateChatIntegrationDto) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectKey} not found`);
    }

    return this.chatNotificationsService.create({
      projectId: project.id,
      ...dto,
    });
  }

  @Get('chat-integrations/:id')
  @ApiOperation({ summary: 'Get a chat integration by ID' })
  @UseGuards(ChatIntegrationMembershipGuard)
  async getById(@Param('id') id: string) {
    return this.chatNotificationsService.getById(parseInt(id, 10));
  }

  @Put('chat-integrations/:id')
  @ApiOperation({ summary: 'Update a chat integration' })
  @UseGuards(ChatIntegrationMembershipGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateChatIntegrationDto) {
    return this.chatNotificationsService.update(parseInt(id, 10), dto);
  }

  @Delete('chat-integrations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a chat integration' })
  @UseGuards(ChatIntegrationMembershipGuard)
  async delete(@Param('id') id: string) {
    await this.chatNotificationsService.delete(parseInt(id, 10));
  }

  @Post('chat-integrations/:id/test')
  @ApiOperation({ summary: 'Test a chat integration connection' })
  @UseGuards(ChatIntegrationMembershipGuard)
  async test(@Param('id') id: string) {
    return this.chatNotificationsService.testConnection(parseInt(id, 10));
  }
}
