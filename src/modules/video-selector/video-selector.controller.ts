import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiLocaleHeader } from '../../common/api-locale-header.decorator';
import { Locale } from '../../common/locale.decorator';
import { ApiRestArrayResponse } from '../../components/api-response.decorator';
import { RestResponse } from '../../models/rest.response';
import {
  ListVideoSelectorsQuery,
  VideoSelectorResponse,
} from '../../models/user-api.io';
import { VideoSelectorService } from './video-selector.service';

@Controller('video-selectors')
@ApiLocaleHeader()
export class VideoSelectorController {
  constructor(private readonly videoSelectorService: VideoSelectorService) {}

  @ApiOperation({ summary: 'List video selectors' })
  @ApiRestArrayResponse(VideoSelectorResponse)
  @Get()
  async listVideoSelectors(
    @Query() query: ListVideoSelectorsQuery,
    @Locale() locale: string,
  ) {
    const selectors = await this.videoSelectorService.listPublicVideoSelectors({
      selectorType: query.selector_type,
    });

    return RestResponse.success(
      await this.videoSelectorService.toPublicResponses(selectors, locale),
    );
  }
}
