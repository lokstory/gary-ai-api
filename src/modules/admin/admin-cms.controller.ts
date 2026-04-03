import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SwaggerBearer } from '../../models/constants';
import { RestResponse } from '../../models/rest.response';
import { ApiRestResponse } from '../../components/api-response.decorator';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { AdminService } from './admin.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import { AdminMeResponse } from '../../models/admin-api.io';

@Controller('cms/admins')
export class AdminCmsController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Get current admin profile' })
  @ApiBearerAuth(SwaggerBearer.ADMIN)
  @UseGuards(AdminJwtAuthGuard)
  @ApiRestResponse(AdminMeResponse)
  @Get('me')
  async me(@Req() req: { user: { id: string } }) {
    const admin = await this.adminService.findById(BigInt(req.user.id));
    if (!admin) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    return RestResponse.success({
      id: admin.id.toString(),
      username: admin.username,
      name: admin.name,
      role: admin.role,
      enabled: admin.enabled,
    });
  }
}
