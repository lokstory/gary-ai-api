import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminCategoryResponse,
  AdminCreateCategoryRequest,
  AdminListCategoriesQuery,
  AdminUpdateCategoryRequest,
} from '../../models/admin-api.io';
import { PaginatedResponse, RestResponse } from '../../models/rest.response';
import { SwaggerBearer } from '../../models/constants';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { CategoryService } from './category.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import {
  ApiEmptyRestResponse,
  ApiPaginatedResponse,
  ApiRestArrayResponse,
  ApiRestResponse,
} from '../../components/api-response.decorator';

@ApiTags('CMS Categories')
@Controller('cms/categories')
@ApiBearerAuth(SwaggerBearer.ADMIN)
@UseGuards(AdminJwtAuthGuard)
export class CategoryCmsController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiOperation({ summary: 'List categories' })
  @ApiPaginatedResponse(AdminCategoryResponse)
  @Get()
  async listCategories(@Query() query: AdminListCategoriesQuery) {
    const { items, total, page, pageSize } =
      await this.categoryService.listCategories({
        page: query.page,
        pageSize: query.page_size,
        search: query.search,
      });

    return PaginatedResponse.success({
      data: items.map((item) => this.categoryService.toResponse(item)),
      page,
      pageSize,
      total,
    });
  }

  @ApiOperation({ summary: 'List enabled categories' })
  @ApiRestArrayResponse(AdminCategoryResponse)
  @Get('/enabled')
  async listEnabledCategories() {
    const categories = await this.categoryService.listEnabledCategories();
    return RestResponse.success(
      categories.map((item) => this.categoryService.toResponse(item)),
    );
  }

  @ApiOperation({ summary: 'Get category by id' })
  @ApiRestResponse(AdminCategoryResponse)
  @Get(':id')
  async getCategory(@Param('id') id: string) {
    const categoryId = Number(id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    const category = await this.categoryService.getCategoryById(categoryId);
    if (!category) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    return RestResponse.success(this.categoryService.toResponse(category));
  }

  @ApiOperation({ summary: 'Create category' })
  @ApiRestResponse(AdminCategoryResponse)
  @Post()
  async createCategory(@Body() input: AdminCreateCategoryRequest) {
    const category = await this.categoryService.createCategory(input);
    return RestResponse.success(this.categoryService.toResponse(category));
  }

  @ApiOperation({ summary: 'Update category' })
  @ApiRestResponse(AdminCategoryResponse)
  @Patch(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() input: AdminUpdateCategoryRequest,
  ) {
    const categoryId = Number(id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    const category = await this.categoryService.updateCategory(
      categoryId,
      input,
    );
    return RestResponse.success(this.categoryService.toResponse(category));
  }

  @ApiOperation({ summary: 'Delete category' })
  @ApiEmptyRestResponse()
  @Delete(':id')
  async deleteCategory(@Param('id') id: string) {
    const categoryId = Number(id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    await this.categoryService.deleteCategory(categoryId);
    return RestResponse.success();
  }
}
