import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminLoginRequest,
  AdminLoginResponse,
} from '../../models/admin-api.io';
import { RestResponse } from '../../models/rest.response';
import { ApiRestResponse } from '../../components/api-response.decorator';
import { AdminAuthService } from './admin-auth.service';

@ApiTags('CMS Auth')
@Controller('cms/auth')
export class AdminCmsAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @ApiOperation({ summary: 'Admin login' })
  @ApiRestResponse(AdminLoginResponse)
  @Post('login')
  async login(@Body() input: AdminLoginRequest) {
    const data = await this.adminAuthService.loginByUsername(
      input.username,
      input.password,
    );

    return RestResponse.success(data);
  }
}
