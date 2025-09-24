import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { ProductEntity } from 'src/core/entity/product.entity';
import { ProductService } from '../product/product.service';
import { CashBoxModule } from '../cash-box/cash-box.module';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { OrderGateaway } from '../socket/order.gateaway';
import { PostEntity } from 'src/core/entity/post.entity';
import { MyLogger } from 'src/logger/logger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
      CashEntity,
      CashboxHistoryEntity,
      UserEntity,
      PostEntity,
    ]),
    CashBoxModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    ProductService,
    BcryptEncryption,
    Token,
    OrderGateaway,
    MyLogger,
  ],
})
export class OrderModule {}
