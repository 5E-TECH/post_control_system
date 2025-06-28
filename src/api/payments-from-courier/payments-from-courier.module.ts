import { Module } from '@nestjs/common';
import { PaymentsFromCourierService } from './payments-from-courier.service';
import { PaymentsFromCourierController } from './payments-from-courier.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsFromCourierEntity } from 'src/core/entity/payments.from.courier';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryService } from '../cashbox-history/cashbox-history.service';
import { CasheBoxService } from '../cash-box/cash-box.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentsFromCourierEntity, CashboxHistoryEntity, CashEntity])],
  controllers: [PaymentsFromCourierController],
  providers: [PaymentsFromCourierService, CashboxHistoryService, CasheBoxService],
})
export class PaymentsFromCourierModule {}
