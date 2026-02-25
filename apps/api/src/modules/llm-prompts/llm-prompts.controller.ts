import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateLlmPromptDto } from './dto/create-llm-prompt.dto';
import { UpdateLlmPromptDto } from './dto/update-llm-prompt.dto';
import { LlmPromptsService } from './llm-prompts.service';

@ApiTags('admin/llm-prompts')
@ApiBearerAuth()
@Controller('admin/llm-prompts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class LlmPromptsController {
  constructor(private readonly llmPromptsService: LlmPromptsService) {}

  @Get()
  @ApiOperation({ summary: 'List LLM prompt templates (admin only)' })
  list() {
    return this.llmPromptsService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create LLM prompt template (admin only)' })
  create(@Body() dto: CreateLlmPromptDto) {
    return this.llmPromptsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update LLM prompt template (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateLlmPromptDto) {
    return this.llmPromptsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete LLM prompt template (admin only)' })
  remove(@Param('id') id: string) {
    return this.llmPromptsService.remove(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate LLM prompt template (admin only)' })
  activate(@Param('id') id: string) {
    return this.llmPromptsService.activate(id);
  }
}
