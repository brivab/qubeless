import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLlmPromptDto } from './dto/create-llm-prompt.dto';
import { UpdateLlmPromptDto } from './dto/update-llm-prompt.dto';

@Injectable()
export class LlmPromptsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.llmPromptTemplate.findMany({
      orderBy: [{ name: 'asc' }, { version: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateLlmPromptDto) {
    const data = {
      name: dto.name.trim(),
      version: dto.version.trim(),
      systemPrompt: dto.systemPrompt,
      taskPrompt: dto.taskPrompt,
      isActive: dto.isActive ?? false,
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (data.isActive) {
          await tx.llmPromptTemplate.updateMany({
            data: { isActive: false },
            where: { name: data.name, isActive: true },
          });
        }

        return tx.llmPromptTemplate.create({ data });
      });
    } catch (error) {
      this.handleUniqueError(error, data.name, data.version);
      throw error;
    }
  }

  async update(id: string, dto: UpdateLlmPromptDto) {
    const existing = await this.prisma.llmPromptTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`LLM prompt template with id "${id}" not found`);
    }

    const data: Record<string, any> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.version !== undefined) data.version = dto.version.trim();
    if (dto.systemPrompt !== undefined) data.systemPrompt = dto.systemPrompt;
    if (dto.taskPrompt !== undefined) data.taskPrompt = dto.taskPrompt;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const targetName = (data.name as string | undefined) ?? existing.name;
    const shouldActivate = (data.isActive as boolean | undefined) ?? existing.isActive;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (shouldActivate) {
          await tx.llmPromptTemplate.updateMany({
            data: { isActive: false },
            where: { name: targetName, isActive: true },
          });
        }

        return tx.llmPromptTemplate.update({
          where: { id },
          data,
        });
      });
    } catch (error) {
      this.handleUniqueError(error, targetName, data.version ?? existing.version);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const deleted = await this.prisma.llmPromptTemplate.delete({ where: { id } });
      return { id: deleted.id };
    } catch (error) {
      throw new NotFoundException(`LLM prompt template with id "${id}" not found`);
    }
  }

  async activate(id: string) {
    const existing = await this.prisma.llmPromptTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`LLM prompt template with id "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.llmPromptTemplate.updateMany({
        data: { isActive: false },
        where: { name: existing.name, isActive: true },
      });

      return tx.llmPromptTemplate.update({
        where: { id },
        data: { isActive: true },
      });
    });
  }

  private handleUniqueError(error: unknown, name: string, version: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(
        `Prompt template ${name} with version ${version} already exists`,
      );
    }
  }
}
