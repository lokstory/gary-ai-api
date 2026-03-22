import { Injectable, ValidationPipe } from '@nestjs/common';
import { AppCode, getAppCode } from '../models/app.code';
import { AppException } from '../models/app.exception';

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        let code: number | undefined = undefined;
        let message: string | undefined = undefined;
        const formattedErrors: any[] = [];

        console.log('errors', errors);

        for (const err of errors) {
          const constraints = err.constraints || {};
          const contexts = err.contexts || {};

          if (code === undefined) {
            for (const key in contexts) {
              if (contexts[key]?.code) {
                code = contexts[key].code;
                break;
              }
            }
          }

          // 取第一個 message
          if (message === undefined) {
            const firstMessage = Object.values(constraints).find(
              (msg) => !!msg,
            );
            if (firstMessage) message = firstMessage;
          }

          // 將 constraints 格式化
          // formattedErrors.push({
          //   property: err.property,
          //   constraints: Object.entries(constraints).map(([k, msg]) => ({
          //     message: msg,
          //     appCode: contexts[k]?.appCode ?? AppCode.PARAMETER_ERROR[0],
          //   })),
          // });
        }

        const appCode = code ? getAppCode(code) : AppCode.PARAMETER_ERROR;

        return new AppException({
          code: appCode,
          message,
          // errors: formattedErrors || undefined,
        });
      },
    });
  }
}
