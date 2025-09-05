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
import { CashBoxModule } from '../cash-box/cash-box.module';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { CustomerEntity } from 'src/core/entity/customer.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { UserEntity } from 'src/core/entity/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
      MarketEntity,
      CustomerEntity,
      CashEntity,
      CashboxHistoryEntity,
      UserEntity,
    ]),
    CashBoxModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    ProductService,
    MarketService,
    BcryptEncryption,
    Token,
  ],
})
export class OrderModule {}
