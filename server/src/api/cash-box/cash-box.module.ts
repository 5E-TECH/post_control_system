import { Module } from '@nestjs/common';
import { CashBoxService } from './cash-box.service';
import { CasheBoxController } from './cash-box.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashboxCardEntity } from 'src/core/entity/cashbox-card.entity';
import { CashboxCardMovementEntity } from 'src/core/entity/cashbox-card-movement.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { ShiftEntity } from 'src/core/entity/shift.entity';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CashEntity,
      CashboxHistoryEntity,
      CashboxCardEntity,
      CashboxCardMovementEntity,
      OrderEntity,
      UserEntity,
      ShiftEntity,
      FinancialBalanceHistoryEntity,
    ]),
  ],
  controllers: [CasheBoxController],
  providers: [CashBoxService],
  exports: [TypeOrmModule],
})
export class CashBoxModule {}
