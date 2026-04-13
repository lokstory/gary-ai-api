import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { DEFAULT_LOCALE } from './locale.middleware';

export function ApiLocaleHeader() {
  return applyDecorators(
    ApiHeader({
      name: 'X-Locale',
      required: false,
      description: `Locale header. Defaults to ${DEFAULT_LOCALE}.`,
      example: DEFAULT_LOCALE,
    }),
  );
}
