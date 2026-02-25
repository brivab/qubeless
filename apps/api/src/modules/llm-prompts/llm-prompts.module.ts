import { Module } from '@nestjs/common';
import { LlmPromptsController } from './llm-prompts.controller';
import { LlmPromptsService } from './llm-prompts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LlmPromptsController],
  providers: [LlmPromptsService],
})
export class LlmPromptsModule {}
