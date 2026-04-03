import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginatedResponse, RestResponse } from '../models/rest.response';

export function ApiRestResponse<TModel extends Type<any>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(RestResponse, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(RestResponse) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
}

export function ApiPaginatedResponse<TModel extends Type<any>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(PaginatedResponse, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponse) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
}

export function ApiRestArrayResponse<TModel extends Type<any>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(RestResponse, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(RestResponse) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
}

export function ApiEmptyRestResponse() {
  return applyDecorators(
    ApiExtraModels(RestResponse),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(RestResponse) },
          {
            properties: {
              data: {
                type: 'null',
                nullable: true,
              },
            },
          },
        ],
      },
    }),
  );
}
