import { Module } from '@nestjs/common';
import { CashboxHistoryService } from './cashbox-history.service';
import { CashboxHistoryController } from './cashbox-history.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';

@Module({
  imports:[TypeOrmModule.forFeature([CashboxHistoryEntity])],
  controllers: [CashboxHistoryController],
  providers: [CashboxHistoryService],
})
export class CashboxHistoryModule {}
