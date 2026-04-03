import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminCmsAuthController } from './admin-cms-auth.controller';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminCmsController } from './admin-cms.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('ADMIN_JWT_SECRET') ??
          config.getOrThrow('JWT_SECRET'),
        signOptions: {
          expiresIn: (
            config.get<string>('ADMIN_JWT_EXPIRES_IN') ??
            config.getOrThrow<string>('JWT_EXPIRES_IN')
          ) as any,
        },
      }),
    }),
  ],
  controllers: [AdminCmsAuthController, AdminCmsController],
  providers: [AdminService, AdminAuthService, AdminJwtStrategy],
  exports: [AdminService, AdminAuthService],
})
export class AdminModule {}
