import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from 'src/config';
import { UsersModule } from './users/users.module';
import { ProductModule } from './product/product.module';
import { JwtModule } from '@nestjs/jwt';
import { CashBoxModule } from './cash-box/cash-box.module';
import { RegionModule } from './region/region.module';
import { DistrictModule } from './district/district.module';
import { CashboxHistoryModule } from './cashbox-history/cashbox-history.module';
import { LoggerModule } from 'src/logger/logger.module';
import { PostModule } from './post/post.module';
import { OrderModule } from './order/order.module';
import { BotModule } from './bot/bot.module';
import { OrderGateaway } from './socket/order.gateaway';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.DB_URL,
      // universal path: src yoki dist uchun ishlaydi
      entities: [__dirname + '/../core/entity/*.entity{.ts,.js}'],
      synchronize: true,
      autoLoadEntities: true,
    }),
    JwtModule.register({ global: true }),

    // biznes modullar
    UsersModule,
    ProductModule,
    CashBoxModule,
    RegionModule,
    DistrictModule,
    CashboxHistoryModule,
    PostModule,
    OrderModule,
    BotModule,
    DashboardModule,

    // loggerni oxirida yoki avvaliga qo'yish muammo bo'lmaydi — global ekan ishlaydi
    LoggerModule,
  ],
  providers: [OrderGateaway],
})
export class AppModule {}
