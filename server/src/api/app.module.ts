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
import { TelegrafModule } from 'nestjs-telegraf';
import { OrderGateaway } from './socket/order.gateaway';

@Module({
  imports: [
    // TelegrafModule.forRoot({
    //   token: config.BOT_TOKEN,
    // }),
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
    CashBoxModule,
    RegionModule,
    DistrictModule,
    CashboxHistoryModule,
    LoggerModule,
    PostModule,
    OrderModule,
    BotModule,
  ],
  providers: [OrderGateaway],
})
export class AppModule {}
