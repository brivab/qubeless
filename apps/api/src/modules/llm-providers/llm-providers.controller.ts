import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateLlmProviderDto } from './dto/create-llm-provider.dto';
import { UpdateLlmProviderDto } from './dto/update-llm-provider.dto';
import { LlmProvidersService } from './llm-providers.service';

@ApiTags('admin/llm-providers')
@ApiBearerAuth()
@Controller('admin/llm-providers')
@UseGuards(JwtAuthGuard, AdminGuard)
export class LlmProvidersController {
  constructor(private readonly llmProvidersService: LlmProvidersService) {}

  @Get()
  @ApiOperation({ summary: 'List LLM providers (admin only)' })
  list() {
    return this.llmProvidersService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create LLM provider (admin only)' })
  create(@Body() dto: CreateLlmProviderDto) {
    return this.llmProvidersService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update LLM provider (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateLlmProviderDto) {
    return this.llmProvidersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete LLM provider (admin only)' })
  remove(@Param('id') id: string) {
    return this.llmProvidersService.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test LLM provider connection (admin only)' })
  test(@Param('id') id: string) {
    return this.llmProvidersService.testConnection(id);
  }
}
