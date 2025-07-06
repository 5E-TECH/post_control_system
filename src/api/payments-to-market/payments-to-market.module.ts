import { Module } from '@nestjs/common';
import { PaymentsToMarketService } from './payments-to-market.service';
import { PaymentsToMarketController } from './payments-to-market.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsToMarketEntity } from 'src/core/entity/payments-to-market.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { MarketEntity } from 'src/core/entity/market.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentsToMarketEntity, CashEntity, CashboxHistoryEntity, OrderEntity, MarketEntity])],
  controllers: [PaymentsToMarketController],
  providers: [PaymentsToMarketService],
})
export class PaymentsToMarketModule {}
