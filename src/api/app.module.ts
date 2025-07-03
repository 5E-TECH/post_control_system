import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from 'src/config';
import { UsersModule } from './users/users.module';
import { ProductModule } from './product/product.module';
import { JwtModule } from '@nestjs/jwt';
import { MarketModule } from './market/market.module';
import { CashBoxModule } from './cash-box/cash-box.module';
import { PaymentsFromCourierModule } from './payments-from-courier/payments-from-courier.module';
// import { PaymentsToMarketModule } from './payments-to-market/payments-to-market.module';
import { RegionModule } from './region/region.module';
import { DistrictModule } from './district/district.module';
import { CashboxHistoryModule } from './cashbox-history/cashbox-history.module';
import { OrderModule } from './order/order.module';
import { CourierDistrictModule } from './courier_district/courier_district.module';

@Module({
  imports: [
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
    // PaymentsToMarketModule,
    RegionModule,
    DistrictModule,
    CashboxHistoryModule,
    OrderModule,
    CourierDistrictModule,
  ]
})
export class AppModule {}
