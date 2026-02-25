import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole, AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UserDTO } from '@qubeless/shared';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';

export interface CreateUserInput {
  email: string;
  password: string;
  role?: UserRole;
}

/**
 * Service for managing user-related operations.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService, // Injects the Prisma service for database operations
    private readonly auditService: AuditService, // Injects the Audit service for logging actions
  ) {}

  /**
   * Finds a user by their email.
   * @param {string} email - The user's email.
   * @returns {Promise<User | null>} - A promise that resolves to the found user or null if not found.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Finds a user by their ID.
   * @param {string} id - The user's ID.
   * @returns {Promise<User | null>} - A promise that resolves to the found user or null if not found.
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Creates a new user with the provided input.
   * @param {CreateUserInput} input - The user creation input.
   * @param {string | undefined} creatorUserId - The ID of the user who created the user (optional).
   * @param {'local' | 'sso'} method - The authentication method ('local' or 'sso') (default is 'local').
   * @returns {Promise<User>} - A promise that resolves to the created user.
   */
  async createUser(input: CreateUserInput, creatorUserId?: string, method: 'local' | 'sso' = 'local'): Promise<User> {
    const passwordHash = await bcrypt.hash(input.password, 10); // Hashes the user's password
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        globalRole: input.role ?? UserRole.USER, // Assigns a default role if not provided
      },
    });

    await this.auditService.log({
      actorUserId: creatorUserId,
      action: AuditAction.USER_CREATE,
      targetType: 'User',
      targetId: user.id,
      metadata: {
        email: user.email,
        role: user.globalRole,
        method,
      },
    });

    return user;
  }

  /**
   * Creates an SSO user with a randomly generated password.
   * @param {string} email - The user's email.
   * @param {UserRole | undefined} role - The user's role (optional).
   * @param {string | undefined} creatorUserId - The ID of the user who created the user (optional).
   * @returns {Promise<User>} - A promise that resolves to the created SSO user.
   */
  async createSsoUser(email: string, role?: UserRole, creatorUserId?: string): Promise<User> {
    const password = randomBytes(24).toString('hex'); // Generates a random password
    return this.createUser({ email, password, role }, creatorUserId, 'sso');
  }

  /**
   * Converts a User entity to a DTO for serialization.
   * @param {User | null} user - The user entity or null if not found.
   * @returns {UserDTO | null} - The user DTO or null if the input is null.
   */
  toUserDTO(user: User | null): UserDTO | null {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      globalRole: user.globalRole,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
