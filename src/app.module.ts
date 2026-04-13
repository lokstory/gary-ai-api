import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './modules/redis/redis.module';
import { RequestIdMiddleware } from './components/request-id.middleware';
import { TestController } from './test.controller';
import { PromptModule } from './modules/prompt/prompt.module';
import { FileModule } from './modules/file/file.module';
import { CartModule } from './modules/cart/cart.module';
import { OrderModule } from './modules/order/order.module';
import { AdminModule } from './modules/admin/admin.module';
import { LabelModule } from './modules/label/label.module';
import { CategoryModule } from './modules/category/category.module';
import { LocaleMiddleware } from './common/locale.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UserModule,
    RedisModule,
    PromptModule,
    FileModule,
    CartModule,
    OrderModule,
    AdminModule,
    LabelModule,
    CategoryModule,
  ],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, LocaleMiddleware).forRoutes('*');
  }
}
