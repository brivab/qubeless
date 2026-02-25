import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from './email/email.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule],
  providers: [EmailService, NotificationsService],
  exports: [EmailService, NotificationsService],
})
export class NotificationsModule {}
