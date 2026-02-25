import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LlmPromptsService } from './llm-prompts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LlmPromptsService', () => {
  let service: LlmPromptsService;

  const mockPrismaService = {
    llmPromptTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const buildPromptTemplate = (data: Record<string, unknown>) => ({
    id: 'prompt-1',
    name: 'issue-fix',
    version: 'v1',
    systemPrompt: 'You are a senior engineer.',
    taskPrompt: 'Fix the issue.',
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...data,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmPromptsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LlmPromptsService>(LlmPromptsService);

    mockPrismaService.$transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        llmPromptTemplate: {
          create: mockPrismaService.llmPromptTemplate.create,
          update: mockPrismaService.llmPromptTemplate.update,
          updateMany: mockPrismaService.llmPromptTemplate.updateMany,
        },
      });
    });

    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should list prompt templates with expected ordering', async () => {
      const templates = [buildPromptTemplate({ id: 'prompt-1' })];
      mockPrismaService.llmPromptTemplate.findMany.mockResolvedValue(templates);

      const result = await service.list();

      expect(result).toEqual(templates);
      expect(mockPrismaService.llmPromptTemplate.findMany).toHaveBeenCalledWith({
        orderBy: [{ name: 'asc' }, { version: 'desc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('create', () => {
    it('should trim fields and deactivate previous active template when isActive=true', async () => {
      mockPrismaService.llmPromptTemplate.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.llmPromptTemplate.create.mockImplementation(({ data }: any) =>
        Promise.resolve(buildPromptTemplate(data)),
      );

      const result = await service.create({
        name: ' issue-fix ',
        version: ' v2 ',
        systemPrompt: 'System prompt',
        taskPrompt: 'Task prompt',
        isActive: true,
      });

      expect(mockPrismaService.llmPromptTemplate.updateMany).toHaveBeenCalledWith({
        data: { isActive: false },
        where: { name: 'issue-fix', isActive: true },
      });
      expect(mockPrismaService.llmPromptTemplate.create).toHaveBeenCalledWith({
        data: {
          name: 'issue-fix',
          version: 'v2',
          systemPrompt: 'System prompt',
          taskPrompt: 'Task prompt',
          isActive: true,
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          name: 'issue-fix',
          version: 'v2',
          isActive: true,
        }),
      );
    });

    it('should not deactivate previous templates when isActive is false', async () => {
      mockPrismaService.llmPromptTemplate.create.mockImplementation(({ data }: any) =>
        Promise.resolve(buildPromptTemplate(data)),
      );

      await service.create({
        name: 'issue-fix',
        version: 'v1',
        systemPrompt: 'System prompt',
        taskPrompt: 'Task prompt',
        isActive: false,
      });

      expect(mockPrismaService.llmPromptTemplate.updateMany).not.toHaveBeenCalled();
    });

    it('should map unique constraint errors to BadRequestException', async () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test' },
      );
      mockPrismaService.llmPromptTemplate.create.mockRejectedValue(uniqueError);

      await expect(
        service.create({
          name: 'issue-fix',
          version: 'v1',
          systemPrompt: 'System prompt',
          taskPrompt: 'Task prompt',
          isActive: false,
        }),
      ).rejects.toThrow(
        new BadRequestException('Prompt template issue-fix with version v1 already exists'),
      );
    });
  });

  describe('update', () => {
    it('should throw when prompt template does not exist', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue(null);

      await expect(service.update('missing-id', {})).rejects.toThrow(
        new NotFoundException('LLM prompt template with id "missing-id" not found'),
      );
    });

    it('should update prompt and deactivate other active versions when needed', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue(
        buildPromptTemplate({
          id: 'prompt-1',
          name: 'issue-fix',
          version: 'v1',
          isActive: false,
        }),
      );
      mockPrismaService.llmPromptTemplate.update.mockImplementation(({ data }: any) =>
        Promise.resolve(buildPromptTemplate(data)),
      );

      await service.update('prompt-1', {
        name: ' issue-fix ',
        version: ' v3 ',
        isActive: true,
      });

      expect(mockPrismaService.llmPromptTemplate.updateMany).toHaveBeenCalledWith({
        data: { isActive: false },
        where: { name: 'issue-fix', isActive: true },
      });
      expect(mockPrismaService.llmPromptTemplate.update).toHaveBeenCalledWith({
        where: { id: 'prompt-1' },
        data: {
          name: 'issue-fix',
          version: 'v3',
          isActive: true,
        },
      });
    });

    it('should map unique constraint errors during update', async () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test' },
      );
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue(
        buildPromptTemplate({
          id: 'prompt-1',
          name: 'issue-fix',
          version: 'v1',
          isActive: false,
        }),
      );
      mockPrismaService.llmPromptTemplate.update.mockRejectedValue(uniqueError);

      await expect(
        service.update('prompt-1', { version: 'v1' }),
      ).rejects.toThrow(
        new BadRequestException('Prompt template issue-fix with version v1 already exists'),
      );
    });
  });

  describe('remove', () => {
    it('should return deleted id', async () => {
      mockPrismaService.llmPromptTemplate.delete.mockResolvedValue({ id: 'prompt-1' });

      const result = await service.remove('prompt-1');

      expect(result).toEqual({ id: 'prompt-1' });
    });

    it('should throw NotFoundException when delete fails', async () => {
      mockPrismaService.llmPromptTemplate.delete.mockRejectedValue(new Error('delete failed'));

      await expect(service.remove('missing-id')).rejects.toThrow(
        new NotFoundException('LLM prompt template with id "missing-id" not found'),
      );
    });
  });

  describe('activate', () => {
    it('should throw when prompt template does not exist', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue(null);

      await expect(service.activate('missing-id')).rejects.toThrow(
        new NotFoundException('LLM prompt template with id "missing-id" not found'),
      );
    });

    it('should activate template and deactivate previous active ones', async () => {
      mockPrismaService.llmPromptTemplate.findUnique.mockResolvedValue(
        buildPromptTemplate({
          id: 'prompt-1',
          name: 'issue-fix',
          isActive: false,
        }),
      );
      mockPrismaService.llmPromptTemplate.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.llmPromptTemplate.update.mockResolvedValue(
        buildPromptTemplate({
          id: 'prompt-1',
          isActive: true,
        }),
      );

      const result = await service.activate('prompt-1');

      expect(mockPrismaService.llmPromptTemplate.updateMany).toHaveBeenCalledWith({
        data: { isActive: false },
        where: { name: 'issue-fix', isActive: true },
      });
      expect(mockPrismaService.llmPromptTemplate.update).toHaveBeenCalledWith({
        where: { id: 'prompt-1' },
        data: { isActive: true },
      });
      expect(result).toEqual(expect.objectContaining({ id: 'prompt-1', isActive: true }));
    });
  });
});
