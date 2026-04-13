import { HttpException, HttpStatus } from '@nestjs/common';
import { AppCode, AppCodeType } from './app.code';

export class AppException extends HttpException {
  constructor({
    code = AppCode.SERVER_ERROR,
    message,
    errors,
    status,
  }: {
    code?: AppCodeType;
    message?: string;
    errors?: any[];
    status?: HttpStatus;
  } = {}) {
    const [codeValue, defaultMessage] = code;

    if (!status) {
      status =
        codeValue >= 400 && codeValue < 600
          ? (codeValue as HttpStatus)
          : HttpStatus.OK;
    }
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
