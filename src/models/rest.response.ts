import { AppCode, AppCodeType } from './app.code';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RestResponse<T = any> {
  @ApiProperty({ description: 'Code, 0 for success, others for errors' })
  code: number | string;

  @ApiProperty({ description: 'Message for developers' })
  message: string;

  @ApiPropertyOptional({
    description: 'Response data',
    type: Object,
    nullable: true,
  })
  data: T | null = null;

  @ApiProperty({ description: 'ISO8601 timestamp' })
  timestamp: string = new Date().toISOString();

  @ApiPropertyOptional({ description: 'Optional errors array', type: [Object] })
  errors?: any[];

  @ApiPropertyOptional({ description: 'Extra info', type: Object })
  extra?: any;

  constructor({
    code = AppCode.SUCCESS,
    message,
    data = null,
    errors,
    extra,
  }: {
    code?: AppCodeType;
    message?: string;
    data?: T | null;
    errors?: any[];
    extra?: any;
  } = {}) {
    const [codeValue, defaultMessage] = code;
    this.code = codeValue;
    this.message = message ?? defaultMessage;
    this.data = data;

    if (errors) {
      this.errors = errors;
    }

    if (extra) {
      this.extra = extra;
    }
  }

  static success(data: any = null) {
    return new RestResponse({ data });
  }
}

export class PaginationMeta {
  @ApiProperty()
  page: number;

  @ApiProperty()
  page_size: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  total_pages: number;

  constructor(page: number, pageSize: number, total: number) {
    this.page = page;
    this.page_size = pageSize;
    this.total = total;
    this.total_pages = Math.ceil(total / pageSize);
  }
}

export class PaginatedResponse<T> extends RestResponse<T[]> {
  @ApiProperty({ type: PaginationMeta })
  meta: PaginationMeta;

  constructor({
    data,
    page,
    pageSize,
    total,
  }: {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
  }) {
    super({ data });
    this.meta = new PaginationMeta(page, pageSize, total);
  }

  static success<T>({
    data,
    page,
    pageSize,
    total,
  }: {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
  }) {
    return new PaginatedResponse({ data, page, pageSize, total });
  }
}
