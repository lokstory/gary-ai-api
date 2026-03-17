import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { PromptsService } from './prompts.service';
import { ListPromptsQuery } from '../models/user-api';
import { PaginatedResponse, RestResponse } from '../models/rest-response';
import { FilesService } from '../files/files.service';

@Controller('prompts')
export class PromptsController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly filesService: FilesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List prompts' })
  async listPrompts(@Query() query: ListPromptsQuery) {
    const { items, page, pageSize, total } =
      await this.promptsService.listPrompts({
        page: query.page,
        pageSize: query.page_size,
        search: query.search,
      });

    const fileMap = await this.attachFilesToPrompts(items);

    const data = items.map((item) => {
      const { public_id, name, description, price, enabled, created_at } = item;
      const files = fileMap.get(item.id) || [];
      return {
        uuid: public_id,
        name,
        description,
        price,
        enabled,
        created_at,
        files,
      };
    });

    return PaginatedResponse.success({ data, page, pageSize, total });
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get prompt by UUID' })
  async getPrompt(@Param('uuid') publicId: string) {
    const prompt = await this.promptsService.getPromptByPublicId(publicId);
    if (!prompt) return RestResponse.success();

    const fileMap = await this.attachFilesToPrompts([prompt]);
    const files = fileMap.get(prompt.id) || [];

    const { public_id, name, description, price, enabled, created_at } = prompt;

    return RestResponse.success({
      uuid: public_id,
      name,
      description,
      price,
      enabled,
      created_at,
      files,
    });
  }

  private async attachFilesToPrompts<T extends { id: bigint }>(
    items: T[],
  ): Promise<Map<bigint, any[]>> {
    const fileMap: Map<bigint, any[]> = new Map();
    if (!items || items.length === 0) return fileMap;

    const ids = items.map((item) => item.id);
    const files = await this.filesService.listFilesByRefIds('prompts', ids);

    files.forEach((file) => {
      if (!fileMap.has(file.ref_id)) {
        fileMap.set(file.ref_id, []);
      }
      const { file_type, position, url, created_at } = file;
      fileMap.get(file.ref_id)?.push({ file_type, position, url, created_at });
    });

    fileMap.forEach((arr) => {
      arr.sort((a, b) => a.position - b.position);
    });

    return fileMap;
  }
}
