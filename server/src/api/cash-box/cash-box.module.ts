import { Module } from '@nestjs/common';
import { CashBoxService } from './cash-box.service';
import { CasheBoxController } from './cash-box.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { MyLogger } from 'src/logger/logger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CashEntity,
      CashboxHistoryEntity,
      OrderEntity,
      UserEntity,
    ]),
  ],
  controllers: [CasheBoxController],
  providers: [CashBoxService],
  exports: [TypeOrmModule],
})
export class CashBoxModule {}
