import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './components/app-exception-filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SwaggerBearer } from './models/constants';
import { AppValidationPipe } from './components/app-validation-pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalPipes(new AppValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('GaryTu AI API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      SwaggerBearer.USER,
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      SwaggerBearer.ADMIN,
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
