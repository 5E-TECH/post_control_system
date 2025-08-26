import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketEntity } from 'src/core/entity/market.entity';
import { RegionEntity } from 'src/core/entity/region.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { CustomerEntity } from 'src/core/entity/customer.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { CustomerMarketEntity } from 'src/core/entity/customer-market.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerEntity,
      MarketEntity,
      RegionEntity,
      DistrictEntity,
      OrderEntity,
      OrderItemEntity,
      CustomerMarketEntity,
    ]),
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
