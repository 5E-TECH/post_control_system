import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderService } from '../order/order.service';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { ProductEntity } from 'src/core/entity/product.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { OrderGateaway } from '../socket/order.gateaway';
import { MyLogger } from 'src/logger/logger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderItemEntity,
      OrderEntity,
      ProductEntity,
      CashEntity,
      CashboxHistoryEntity,
      UserEntity,
      PostEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, OrderService, OrderGateaway, MyLogger],
  exports: [MyLogger],
})
export class DashboardModule {}
