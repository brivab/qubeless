import { Test, TestingModule } from '@nestjs/testing';
import { SsoProvider } from '@prisma/client';
import { SsoIdentityService } from './sso-identity.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SsoIdentityService', () => {
  let service: SsoIdentityService;

  const mockPrismaService = {
    ssoIdentity: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoIdentityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SsoIdentityService>(SsoIdentityService);
    jest.clearAllMocks();
  });

  describe('findByProviderSubject', () => {
    it('should query identity by provider+subject and include user', async () => {
      const identity = {
        id: 'identity-1',
        provider: SsoProvider.OIDC,
        subject: 'sub-123',
        email: 'user@example.com',
        userId: 'user-1',
        user: { id: 'user-1', email: 'user@example.com' },
      };
      mockPrismaService.ssoIdentity.findUnique.mockResolvedValue(identity);

      const result = await service.findByProviderSubject(SsoProvider.OIDC, 'sub-123');

      expect(mockPrismaService.ssoIdentity.findUnique).toHaveBeenCalledWith({
        where: {
          provider_subject: {
            provider: SsoProvider.OIDC,
            subject: 'sub-123',
          },
        },
        include: { user: true },
      });
      expect(result).toEqual(identity);
    });
  });

  describe('createIdentity', () => {
    it('should create identity with include user', async () => {
      const input = {
        provider: SsoProvider.SAML,
        subject: 'saml-subject-1',
        email: 'user@example.com',
        userId: 'user-1',
      };
      const created = {
        id: 'identity-2',
        ...input,
        user: { id: 'user-1', email: 'user@example.com' },
      };
      mockPrismaService.ssoIdentity.create.mockResolvedValue(created);

      const result = await service.createIdentity(input);

      expect(mockPrismaService.ssoIdentity.create).toHaveBeenCalledWith({
        data: input,
        include: { user: true },
      });
      expect(result).toEqual(created);
    });
  });
});
