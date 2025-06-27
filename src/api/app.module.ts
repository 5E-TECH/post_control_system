import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from 'src/config';
import { UsersModule } from './users/users.module';
import { ProductModule } from './product/product.module';
import { JwtModule } from '@nestjs/jwt';
import { MarketModule } from './market/market.module';

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
  ]
})
export class AppModule {}
