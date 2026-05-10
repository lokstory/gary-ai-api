import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { RestResponse } from '../../models/rest.response';
import { KlingService } from './kling.service';
import type { KlingWebhookPayload } from './kling.types';

@Controller('webhooks/kling')
export class KlingWebhookController {
  constructor(private readonly klingService: KlingService) {}

  @ApiOperation({ summary: 'Kling webhook receiver' })
  @Post(':token')
  @HttpCode(200)
  async handleCallback(
    @Param('token') token: string,
    @Body() payload: KlingWebhookPayload,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    await this.klingService.handleWebhookCallback(token, payload, headers);
    return RestResponse.success();
  }
}
