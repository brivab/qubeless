import { Module } from '@nestjs/common';
import { ChatNotificationsService } from './chat-notifications.service';
import { ChatNotificationsController } from './chat-notifications.controller';
import { SlackProvider } from './providers/slack.provider';
import { TeamsProvider } from './providers/teams.provider';
import { DiscordProvider } from './providers/discord.provider';
import { GenericWebhookProvider } from './providers/generic.provider';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatIntegrationMembershipGuard } from './guards/chat-integration-membership.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ChatNotificationsController],
  providers: [
    ChatNotificationsService,
    ChatIntegrationMembershipGuard,
    SlackProvider,
    TeamsProvider,
    DiscordProvider,
    GenericWebhookProvider,
  ],
  exports: [ChatNotificationsService],
})
export class ChatNotificationsModule {}
