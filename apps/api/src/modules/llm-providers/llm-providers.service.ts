import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateLlmProviderDto } from './dto/create-llm-provider.dto';
import { UpdateLlmProviderDto } from './dto/update-llm-provider.dto';

@Injectable()
export class LlmProvidersService {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-cbc';

  constructor(private readonly prisma: PrismaService) {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const key = process.env.LLM_PROVIDER_ENCRYPTION_KEY
      ?? (nodeEnv === 'production' ? null : 'default-key-change-in-production-32');
    if (!key) {
      throw new Error('LLM_PROVIDER_ENCRYPTION_KEY is required in production');
    }
    this.encryptionKey = Buffer.from(key.padEnd(32, '0').substring(0, 32));
  }

  async list() {
    const providers = await this.prisma.llmProvider.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return providers.map((provider) => this.sanitize(provider));
  }

  async create(dto: CreateLlmProviderDto) {
    const payload = this.buildProviderPayload(dto);

    return this.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.llmProvider.updateMany({
          data: { isDefault: false },
          where: { isDefault: true },
        });
      }

      const created = await tx.llmProvider.create({
        data: payload,
      });

      return this.sanitize(created);
    });
  }

  async update(id: string, dto: UpdateLlmProviderDto) {
    const existing = await this.prisma.llmProvider.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`LLM provider with id "${id}" not found`);
    }

    const data: Record<string, any> = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.providerType !== undefined) data.providerType = dto.providerType.trim();
    if (dto.baseUrl !== undefined) data.baseUrl = dto.baseUrl.trim();
    if (dto.model !== undefined) data.model = dto.model ? dto.model.trim() : null;
    if (dto.headersJson !== undefined) {
      data.headersJson = dto.headersJson ?? Prisma.JsonNull;
    }
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;

    if (Object.prototype.hasOwnProperty.call(dto, 'token')) {
      const token = dto.token?.trim();
      data.tokenEncrypted = token ? this.encrypt(token) : null;
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.llmProvider.updateMany({
          data: { isDefault: false },
          where: { isDefault: true },
        });
      }

      const updated = await tx.llmProvider.update({
        where: { id },
        data,
      });

      return this.sanitize(updated);
    });
  }

  async remove(id: string) {
    try {
      const deleted = await this.prisma.llmProvider.delete({ where: { id } });
      return { id: deleted.id };
    } catch (error: any) {
      throw new NotFoundException(`LLM provider with id "${id}" not found`);
    }
  }

  async testConnection(id: string) {
    const provider = await this.prisma.llmProvider.findUnique({ where: { id } });
    if (!provider) {
      throw new NotFoundException(`LLM provider with id "${id}" not found`);
    }

    const headers: Record<string, string> = {};
    const rawHeaders = provider.headersJson;

    if (rawHeaders && typeof rawHeaders === 'object' && !Array.isArray(rawHeaders)) {
      for (const [key, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
        if (value === undefined || value === null) continue;
        headers[key] = typeof value === 'string' ? value : String(value);
      }
    }

    if (provider.tokenEncrypted) {
      const token = this.decrypt(provider.tokenEncrypted);
      if (!('Authorization' in headers) && !('authorization' in headers)) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    let response;
    try {
      response = await fetch(provider.baseUrl, {
        method: 'GET',
        headers,
      });
    } catch (error: any) {
      throw new BadRequestException(`Connection failed: ${error?.message ?? 'network error'}`);
    }

    if (!response.ok) {
      throw new BadRequestException(`Provider ping failed (${response.status})`);
    }

    return { success: true, status: response.status };
  }

  private buildProviderPayload(dto: CreateLlmProviderDto) {
    const token = dto.token?.trim();

    return {
      name: dto.name.trim(),
      providerType: dto.providerType.trim(),
      baseUrl: dto.baseUrl.trim(),
      model: dto.model?.trim() || null,
      headersJson: dto.headersJson ?? Prisma.JsonNull,
      tokenEncrypted: token ? this.encrypt(token) : null,
      isDefault: dto.isDefault ?? false,
    };
  }

  private sanitize(provider: any) {
    const tokenMasked = provider.tokenEncrypted
      ? this.maskToken(this.decrypt(provider.tokenEncrypted))
      : null;

    const { tokenEncrypted, ...rest } = provider;

    return {
      ...rest,
      tokenMasked,
      hasToken: Boolean(tokenEncrypted),
    };
  }

  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private maskToken(token: string): string {
    if (token.length <= 12) return '***';
    return `***${token.substring(token.length - 8)}`;
  }
}
