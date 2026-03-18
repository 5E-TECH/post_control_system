import { Module } from '@nestjs/common';
import { CashBoxModule } from '../cash-box/cash-box.module';
import { CashboxHistoryModule } from '../cashbox-history/cashbox-history.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [CashBoxModule, CashboxHistoryModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
