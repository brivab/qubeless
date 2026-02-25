import { Module } from '@nestjs/common';
import { DuplicationController } from './duplication.controller';
import { DuplicationService } from './duplication.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DuplicationController],
  providers: [DuplicationService],
  exports: [DuplicationService],
})
export class DuplicationModule {}
