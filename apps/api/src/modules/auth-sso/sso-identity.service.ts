import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SsoProvider } from '@prisma/client';

@Injectable()
export class SsoIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  findByProviderSubject(provider: SsoProvider, subject: string) {
    return this.prisma.ssoIdentity.findUnique({
      where: {
        provider_subject: {
          provider,
          subject,
        },
      },
      include: { user: true },
    });
  }

  createIdentity(input: { provider: SsoProvider; subject: string; email: string; userId: string }) {
    return this.prisma.ssoIdentity.create({
      data: input,
      include: { user: true },
    });
  }
}
