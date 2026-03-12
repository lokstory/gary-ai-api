import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { AppException } from '../models/app-exception';
import { AppCode } from '../models/app-code';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.users.findUnique({ where: { email } });
  }

  async hashPassword(password: string) {
    return await argon2.hash(password);
  }

  async createUser(email: string, passwordHash: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new AppException({ code: AppCode.USER_ALREADY_EXISTS });
    }

    return this.prisma.users.create({
      data: {
        email,
        password_hash: passwordHash,
        email_verified: true,
      },
    });
  }

  async verifyPassword(passwordHash: string, password: string) {
    return await argon2.verify(passwordHash, password);
  }

  async verifyEmailOtp(email: string, otp: string) {
    return otp === '123456';
  }

  async markEmailVerified(email: string) {
    return this.prisma.users.update({
      where: { email },
      data: { email_verified: true },
    });
  }
}
