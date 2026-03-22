import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../models/app.exception';
import { RestResponse } from '../models/rest.response';
import { AppCodeType } from '../models/app.code';

@Catch(AppException)
export class AppExceptionFilter implements ExceptionFilter<AppException> {
  catch(exception: AppException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const res: any = exception.getResponse();

    const result = new RestResponse({
      code: [res.code, res.message] as AppCodeType,
      data: null,
      errors: res.errors,
    });

    response.status(exception.getStatus()).json(result);
  }
}
