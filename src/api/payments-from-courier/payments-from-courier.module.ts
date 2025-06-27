import { Module } from '@nestjs/common';
import { PaymentsFromCourierService } from './payments-from-courier.service';
import { PaymentsFromCourierController } from './payments-from-courier.controller';

@Module({
  controllers: [PaymentsFromCourierController],
  providers: [PaymentsFromCourierService],
})
export class PaymentsFromCourierModule {}
