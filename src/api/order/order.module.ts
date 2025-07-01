import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { ProductEntity } from 'src/core/entity/product.entity';
import { MarketEntity } from 'src/core/entity/market.entity';
import { ProductService } from '../product/product.service';
import { MarketService } from '../market/market.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
      MarketEntity,
    ]),
  ],
  controllers: [OrderController],
  providers: [OrderService, ProductService, MarketService],
})
export class OrderModule {}
