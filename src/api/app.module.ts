import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from 'src/config';
import { UsersModule } from './users/users.module';
import { ProductModule } from './product/product.module';
import { JwtModule } from '@nestjs/jwt';
import { MarketModule } from './market/market.module';
import { CasheBoxModule } from './cashe-box/cashe-box.module';
import { PaymentsFromCourierModule } from './payments-from-courier/payments-from-courier.module';
import { PaymentsToMarketModule } from './payments-to-market/payments-to-market.module';

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
    CasheBoxModule,
    PaymentsFromCourierModule,
    PaymentsToMarketModule,
  ]
})
export class AppModule {}
