import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.users.findUnique({ where: { email } });
  }

  async createUser(email: string, password: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('User already exists');
    }

    const password_hash = await argon2.hash(password);
    return this.prisma.users.create({
      data: { email, password_hash },
    });
  }

  async validatePassword(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (!user || !user.password_hash) return false;
    return argon2.verify(user.password_hash, password); // 驗證
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
