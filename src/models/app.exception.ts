import { HttpException, HttpStatus } from '@nestjs/common';
import { AppCode, AppCodeType } from './app.code';

export class AppException extends HttpException {
  constructor({
    code = AppCode.SERVER_ERROR,
    message,
    errors,
    status = HttpStatus.OK,
  }: {
    code?: AppCodeType;
    message?: string;
    errors?: any[];
    status?: HttpStatus;
  } = {}) {
    const [codeValue, defaultMessage] = code;

    super(
      {
        code: codeValue,
        message: message ?? defaultMessage,
        ...(errors ? { errors } : {}),
      },
      status,
    );
  }
}
