import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UpdateUserInfoRequest, UserInfoResponse } from '../models/user-api.io';
import { UserService } from './user.service';
import { users } from '../../generated/prisma/client';
import { SwaggerBearer } from '../models/constants';
import { RestResponse } from '../models/rest.response';

@Controller('users')
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @ApiOperation({ summary: 'Get current logged-in user info' })
  @ApiBearerAuth(SwaggerBearer.USER)
  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async getMe(@Req() req): Promise<RestResponse<UserInfoResponse>> {
    const uuid = req.user.uuid;

    const user: users = (await this.usersService.findByPublicId(
      uuid as string,
    )) as users;
    const { email, name } = user;

    const data = new UserInfoResponse({
      uuid,
      email,
      name,
    });

    return RestResponse.success(data);
  }

  @ApiOperation({ summary: 'Update current user info' })
  @ApiBearerAuth(SwaggerBearer.USER)
  @UseGuards(JwtAuthGuard)
  @Patch('/me')
  async updateMe(@Req() req: any, @Body() body: UpdateUserInfoRequest) {
    const uuid = req.user.uuid;

    const user: users = await this.usersService.updateUserInfoByUuid(
      uuid,
      body,
    );

    const { email, name } = user;

    const data = new UserInfoResponse({
      uuid,
      email,
      name,
    });

    return RestResponse.success(data);
  }
}
