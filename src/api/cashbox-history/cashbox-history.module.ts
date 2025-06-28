import { Module } from '@nestjs/common';
import { CashboxHistoryService } from './cashbox-history.service';
import { CashboxHistoryController } from './cashbox-history.controller';

@Module({
  controllers: [CashboxHistoryController],
  providers: [CashboxHistoryService],
})
export class CashboxHistoryModule {}
