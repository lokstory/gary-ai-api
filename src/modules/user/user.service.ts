import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import { users } from '../../../generated/prisma/client';
import { UpdateUserInfoRequest } from '../../models/user-api.io';
import {
  adjectives,
  animals,
  NumberDictionary,
  uniqueNamesGenerator,
} from 'unique-names-generator';

@Injectable()
export class UserService {
  private readonly nameNumberDictionary = NumberDictionary.generate({
    min: 1000,
    max: 9999,
  });

  constructor(private readonly prisma: PrismaService) {}

  async findByPublicId(uuid: string): Promise<users | null> {
    return this.prisma.users.findUnique({ where: { uuid } });
  }

  async findByEmail(email: string) {
    return this.prisma.users.findUnique({ where: { email } });
  }

  async findByGoogleEmail(email: string) {
    return this.prisma.users.findFirst({ where: { google_email: email } });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.users.findUnique({ where: { google_id: googleId } });
  }

  async findByAuthEmail(email: string) {
    const [emailUser, googleUser] = await Promise.all([
      this.findByEmail(email),
      this.findByGoogleEmail(email),
    ]);

    return {
      emailUser,
      googleUser,
    };
  }

  async assertEmailAvailableForEmailAuth(email: string) {
    const { emailUser, googleUser } = await this.findByAuthEmail(email);

    if (emailUser) {
      throw new AppException({ code: AppCode.USER_ALREADY_EXISTS });
    }
    if (googleUser) {
      throw new AppException({ code: AppCode.USER_REGISTERED_WITH_GOOGLE });
    }
  }

  async assertEmailAvailableForGoogleAuth(email: string) {
    const { emailUser, googleUser } = await this.findByAuthEmail(email);

    if (googleUser) {
      throw new AppException({ code: AppCode.USER_ALREADY_EXISTS });
    }
    if (emailUser) {
      throw new AppException({ code: AppCode.USER_REGISTERED_WITH_EMAIL });
    }
  }

  async updateUserInfoByUuid(uuid: string, data: UpdateUserInfoRequest) {
    return this.prisma.users.update({
      where: {
        uuid,
      },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
      },
    });
  }

  async hashPassword(password: string) {
    return await argon2.hash(password);
  }

  generateDefaultUserName() {
    return uniqueNamesGenerator({
      dictionaries: [['User'], adjectives, animals, this.nameNumberDictionary],
      separator: '_',
      style: 'capital',
    });
  }

  async createEmailUser(
    email: string,
    passwordHash: string,
    name: string | null = null,
  ) {
    await this.assertEmailAvailableForEmailAuth(email);

    return this.prisma.users.create({
      data: {
        email,
        name: name ?? this.generateDefaultUserName(),
        password_hash: passwordHash,
        email_verified: true,
      },
    });
  }

  async createGoogleUser(
    googleId: string,
    email: string,
    name: string | null = null,
  ) {
    await this.assertEmailAvailableForGoogleAuth(email);

    return this.prisma.users.create({
      data: {
        google_id: googleId,
        google_email: email,
        name: name ?? this.generateDefaultUserName(),
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

  async updatePasswordById(id: bigint, passwordHash: string) {
    return this.prisma.users.update({
      where: { id },
      data: { password_hash: passwordHash },
    });
  }
}
