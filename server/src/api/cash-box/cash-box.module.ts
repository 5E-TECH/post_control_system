import { Module } from '@nestjs/common';
import { CashBoxService } from './cash-box.service';
import { CasheBoxController } from './cash-box.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { OrderEntity } from 'src/core/entity/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashEntity, CashboxHistoryEntity, OrderEntity]),
  ],
  controllers: [CasheBoxController],
  providers: [CashBoxService],
  exports: [TypeOrmModule],
})
export class CashBoxModule {}
