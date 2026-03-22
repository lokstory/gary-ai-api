import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { AppException } from '../models/app.exception';
import { AppCode } from '../models/app.code';
import { users } from '../../generated/prisma/client';
import { UpdateUserInfoRequest } from '../models/user-api.io';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPublicId(publicId: string): Promise<users | null> {
    return this.prisma.users.findUnique({ where: { public_id: publicId } });
  }

  async findByEmail(email: string) {
    return this.prisma.users.findUnique({ where: { email } });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.users.findUnique({ where: { google_id: googleId } });
  }

  async updateUserInfoByPublicId(
    publicId: string,
    data: UpdateUserInfoRequest,
  ) {
    return this.prisma.users.update({
      where: {
        public_id: publicId,
      },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
      },
    });
  }

  async hashPassword(password: string) {
    return await argon2.hash(password);
  }

  async createEmailUser(
    email: string,
    passwordHash: string,
    name: string | null = null,
  ) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new AppException({ code: AppCode.USER_ALREADY_EXISTS });
    }

    return this.prisma.users.create({
      data: {
        email,
        name,
        password_hash: passwordHash,
        email_verified: true,
      },
    });
  }

  async createGoogleUser(googleId: string, email: string) {
    return this.prisma.users.create({
      data: {
        google_id: googleId,
        google_email: email,
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
