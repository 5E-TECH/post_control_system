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
import { OrderGateaway } from './socket/order.gateaway';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrinterModule } from './printer/printer.module';
import { BotModule } from './bots/notify-bot/bot.module';
import { OrderBotModule } from './bots/order_create-bot/order-bot.module';
import { ExternalProxyModule } from './external-proxy/external-proxy.module';
import { ExternalIntegrationModule } from './external-integration/external-integration.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.DB_URL,
      // universal path: src yoki dist uchun ishlaydi
      entities: [__dirname + '/../core/entity/*.entity{.ts,.js}'],
      autoLoadEntities: true,
      synchronize: true,
      // Connection Pool sozlamalari - yuqori yuklanish uchun
      extra: {
        // Maksimal ulanishlar soni (default: 10)
        max: 50,
        // Minimal ulanishlar soni
        min: 5,
        // Ulanish olishga kutish vaqti (ms)
        connectionTimeoutMillis: 10000,
        // Bo'sh ulanishni yopish vaqti (ms)
        idleTimeoutMillis: 30000,
      },
      // Query timeout (30 sekund)
      maxQueryExecutionTime: 30000,
      // Logging (development uchun)
      logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    }),
    JwtModule.register({ global: true }),
    UsersModule,
    ProductModule,
    CashBoxModule,
    RegionModule,
    DistrictModule,
    CashboxHistoryModule,
    PostModule,
    OrderModule,
    BotModule,
    OrderBotModule,
    DashboardModule,
    LoggerModule,
    PrinterModule,
    ExternalProxyModule,
    ExternalIntegrationModule,
  ],
  providers: [OrderGateaway],
})
export class AppModule {}
