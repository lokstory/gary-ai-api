import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: bigint) {
    return this.prisma.admins.findUnique({ where: { id } });
  }

  async findByUsername(username: string) {
    return this.prisma.admins.findUnique({ where: { username } });
  }

  async verifyPassword(passwordHash: string, password: string) {
    return argon2.verify(passwordHash, password);
  }

  async hashPassword(password: string) {
    return argon2.hash(password);
  }

  async createAdmin(input: {
    username: string;
    passwordHash: string;
    name?: string | null;
    role?: string;
    enabled?: boolean;
  }) {
    const existing = await this.findByUsername(input.username);
    if (existing) {
      throw new AppException({ code: AppCode.USER_ALREADY_EXISTS });
    }

    return this.prisma.admins.create({
      data: {
        username: input.username,
        password_hash: input.passwordHash,
        name: input.name ?? null,
        role: input.role ?? null,
        enabled: input.enabled ?? true,
      },
    });
  }

  async markLoginSuccess(id: bigint) {
    return this.prisma.admins.update({
      where: { id },
      data: { last_login_at: new Date() },
    });
  }
}
