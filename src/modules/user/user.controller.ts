import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { users } from '../../../generated/prisma/client';
import { ApiRestResponse } from '../../components/api-response.decorator';
import { SwaggerBearer } from '../../models/constants';
import { RestResponse } from '../../models/rest.response';
import {
  UpdateUserInfoRequest,
  UserInfoResponse,
} from '../../models/user-api.io';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @ApiOperation({ summary: 'Get current logged-in user info' })
  @ApiBearerAuth(SwaggerBearer.USER)
  @UseGuards(JwtAuthGuard)
  @ApiRestResponse(UserInfoResponse)
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
  @ApiRestResponse(UserInfoResponse)
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
