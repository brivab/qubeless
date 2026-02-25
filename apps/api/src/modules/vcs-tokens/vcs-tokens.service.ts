import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVcsTokenDto } from './dto/create-vcs-token.dto';
import { UpdateVcsTokenDto } from './dto/update-vcs-token.dto';

@Injectable()
export class VcsTokensService {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-cbc';

  constructor(private readonly prisma: PrismaService) {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const key = process.env.VCS_TOKEN_ENCRYPTION_KEY
      ?? (nodeEnv === 'production' ? null : 'default-key-change-in-production-32');
    if (!key) {
      throw new Error('VCS_TOKEN_ENCRYPTION_KEY is required in production');
    }
    this.encryptionKey = Buffer.from(key.padEnd(32, '0').substring(0, 32));
  }

  async list() {
    const tokens = await this.prisma.vcsToken.findMany({
      orderBy: { provider: 'asc' },
    });

    return tokens.map((token) => this.sanitize(token));
  }

  async create(dto: CreateVcsTokenDto) {
    const token = dto.token?.trim();
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    const baseUrl = dto.baseUrl?.trim() || null;

    const existing = await this.prisma.vcsToken.findFirst({
      where: { provider: dto.provider, userId: null },
    });
    if (existing) {
      throw new BadRequestException(`Token already exists for provider "${dto.provider}"`);
    }

    const created = await this.prisma.vcsToken.create({
      data: {
        provider: dto.provider,
        tokenEncrypted: this.encrypt(token),
        baseUrl,
        userId: null,
      },
    });

    return this.sanitize(created);
  }

  async update(id: string, dto: UpdateVcsTokenDto) {
    const existing = await this.prisma.vcsToken.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`VCS token with id "${id}" not found`);
    }

    const data: { tokenEncrypted?: string; baseUrl?: string | null } = {};
    if (Object.prototype.hasOwnProperty.call(dto, 'token')) {
      const token = dto.token?.trim();
      if (!token) {
        throw new BadRequestException('Token is required');
      }
      data.tokenEncrypted = this.encrypt(token);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'baseUrl')) {
      data.baseUrl = dto.baseUrl?.trim() || null;
    }

    if (Object.keys(data).length > 0) {
      const updated = await this.prisma.vcsToken.update({
        where: { id },
        data,
      });
      return this.sanitize(updated);
    }

    return this.sanitize(existing);
  }

  async remove(id: string) {
    try {
      const deleted = await this.prisma.vcsToken.delete({ where: { id } });
      return { id: deleted.id };
    } catch (error: any) {
      throw new NotFoundException(`VCS token with id "${id}" not found`);
    }
  }

  async listForUser(userId: string) {
    const tokens = await this.prisma.vcsToken.findMany({
      where: { userId },
      orderBy: { provider: 'asc' },
    });
    return tokens.map((token) => this.sanitize(token));
  }

  async upsertForUser(userId: string, dto: CreateVcsTokenDto) {
    const token = dto.token?.trim();
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    const baseUrl = dto.baseUrl?.trim() || null;

    const existing = await this.prisma.vcsToken.findFirst({
      where: { provider: dto.provider, userId },
    });

    if (existing) {
      const updated = await this.prisma.vcsToken.update({
        where: { id: existing.id },
        data: { tokenEncrypted: this.encrypt(token), baseUrl },
      });
      return this.sanitize(updated);
    }

    const created = await this.prisma.vcsToken.create({
      data: {
        provider: dto.provider,
        tokenEncrypted: this.encrypt(token),
        baseUrl,
        userId,
      },
    });

    return this.sanitize(created);
  }

  async removeForUser(userId: string, provider: CreateVcsTokenDto['provider']) {
    const existing = await this.prisma.vcsToken.findFirst({
      where: { provider, userId },
    });
    if (!existing) {
      throw new NotFoundException(`VCS token for provider "${provider}" not found`);
    }
    await this.prisma.vcsToken.delete({ where: { id: existing.id } });
    return { id: existing.id };
  }

  private sanitize(token: any) {
    const tokenMasked = token.tokenEncrypted ? this.maskToken(this.decrypt(token.tokenEncrypted)) : null;
    const { tokenEncrypted, ...rest } = token;
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
