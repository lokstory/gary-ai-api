import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UpdateUserInfoRequest, UserInfoResponse } from '../models/user-api.io';
import { UsersService } from './users.service';
import { users } from '../../generated/prisma/client';
import { SwaggerBearer } from '../models/constants';
import { RestResponse } from '../models/rest.response';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get current logged-in user info' })
  @ApiBearerAuth(SwaggerBearer.USER)
  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async getMe(@Req() req): Promise<RestResponse<UserInfoResponse>> {
    const publicId = req.user.public_id;
    console.log(publicId);

    const user: users = (await this.usersService.findByPublicId(
      publicId as string,
    )) as users;
    const { public_id: uuid, email, name } = user;

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
    const publicId = req.user.public_id;
    console.log(publicId);

    const user: users = await this.usersService.updateUserInfoByPublicId(
      publicId,
      body,
    );

    const { public_id: uuid, email, name } = user;

    const data = new UserInfoResponse({
      uuid,
      email,
      name,
    });

    return RestResponse.success(data);
  }
}
