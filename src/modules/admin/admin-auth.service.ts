import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import { AdminService } from './admin.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
  ) {}

  getLoginResponseData(admin: {
    id: bigint;
    username: string;
    role: string | null;
  }) {
    const payload = {
      sub: admin.id.toString(),
      username: admin.username,
      role: admin.role,
      type: 'admin',
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async loginByUsername(username: string, password: string) {
    const admin = await this.adminService.findByUsername(username);

    if (
      !admin ||
      !admin.enabled ||
      !(await this.adminService.verifyPassword(admin.password_hash, password))
    ) {
      throw new AppException({ code: AppCode.UNAUTHORIZED });
    }

    await this.adminService.markLoginSuccess(admin.id);

    return this.getLoginResponseData(admin);
  }
}
