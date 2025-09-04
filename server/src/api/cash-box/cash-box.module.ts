import { Module } from '@nestjs/common';
import { CashBoxService } from './cash-box.service';
import { CasheBoxController } from './cash-box.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashEntity, CashboxHistoryEntity])],
  controllers: [CasheBoxController],
  providers: [CashBoxService],
  exports: [TypeOrmModule],
})
export class CashBoxModule {}
