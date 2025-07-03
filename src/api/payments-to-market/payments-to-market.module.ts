import { Module } from '@nestjs/common';
import { PaymentsToMarketService } from './payments-to-market.service';
// import { PaymentsToMarketController } from './payments-to-market.controller';

@Module({
  // controllers: [PaymentsToMarketController],
  providers: [PaymentsToMarketService],
})
export class PaymentsToMarketModule {}
