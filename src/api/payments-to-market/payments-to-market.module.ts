import { Module } from '@nestjs/common';
import { PaymentsToMarketService } from './payments-to-market.service';
import { PaymentsToMarketController } from './payments-to-market.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsToMarketEntity } from 'src/core/entity/payments-to-market.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentsToMarketEntity])],
  controllers: [PaymentsToMarketController],
  providers: [PaymentsToMarketService],
})
export class PaymentsToMarketModule {}
