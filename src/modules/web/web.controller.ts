import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiLocaleHeader } from '../../common/api-locale-header.decorator';
import { Locale } from '../../common/locale.decorator';
import { ApiRestResponse } from '../../components/api-response.decorator';
import { RestResponse } from '../../models/rest.response';
import { WebConfigResponse } from '../../models/user-api.io';
import { CategoryService } from '../category/category.service';
import { LabelService } from '../label/label.service';

@ApiTags('Web')
@ApiLocaleHeader()
@Controller('web')
export class WebController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly labelService: LabelService,
  ) {}

  @ApiOperation({ summary: 'Get web config' })
  @ApiRestResponse(WebConfigResponse)
  @Get('/config')
  async getConfig(@Locale() locale: string) {
    const [prompt_labels, prompt_categories] = await Promise.all([
      this.labelService.listEnabledLabelsForLocale(locale),
      this.categoryService.listEnabledCategoriesForLocale(locale),
    ]);

    return RestResponse.success({
      prompt_labels,
      prompt_categories,
    });
  }
}
