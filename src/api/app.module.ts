import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from 'src/config';
import { UsersModule } from './users/users.module';
import { ProductModule } from './product/product.module';
import { JwtModule } from '@nestjs/jwt';
import { MarketModule } from './market/market.module';
import { CashBoxModule } from './cash-box/cash-box.module';
import { PaymentsFromCourierModule } from './payments-from-courier/payments-from-courier.module';
import { PaymentsToMarketModule } from './payments-to-market/payments-to-market.module';
import { RegionModule } from './region/region.module';
import { DistrictModule } from './district/district.module';
import { CashboxHistoryModule } from './cashbox-history/cashbox-history.module';
import { LoggerModule } from 'src/logger/logger.module';
import { PostModule } from './post/post.module';
import { OrderModule } from './order/order.module';
import { BotModule } from './bot/bot.module';
import { TelegrafModule } from 'nestjs-telegraf';

@Module({
  imports: [
    TelegrafModule.forRoot({
      token: config.BOT_TOKEN,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.DB_URL,
      entities: ['dist/core/entity/*.entity{.ts,.js}'],
      synchronize: true,
      autoLoadEntities: true,
    }),
    UsersModule,
    ProductModule,
    JwtModule.register({ global: true }),
    MarketModule,
    CashBoxModule,
    PaymentsFromCourierModule,
    PaymentsToMarketModule,
    RegionModule,
    DistrictModule,
    CashboxHistoryModule,
    LoggerModule,
    PostModule,
    OrderModule,
    BotModule,
  ],
})
export class AppModule {}
