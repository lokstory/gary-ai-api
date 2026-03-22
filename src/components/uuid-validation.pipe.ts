import { Injectable, PipeTransform } from '@nestjs/common';
import { validate as isUUID } from 'uuid';
import { AppException } from '../models/app.exception';
import { AppCode } from '../models/app.code';

@Injectable()
export class UUIDValidationPipe implements PipeTransform<string> {
  transform(value: string) {
    if (!isUUID(value)) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }
    return value;
  }
}
