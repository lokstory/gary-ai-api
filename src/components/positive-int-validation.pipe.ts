import { Injectable, PipeTransform } from '@nestjs/common';
import { AppException } from '../models/app.exception';
import { AppCode } from '../models/app.code';

@Injectable()
export class PositiveIntValidationPipe
  implements PipeTransform<string, number>
{
  transform(value: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }
    return parsed;
  }
}
