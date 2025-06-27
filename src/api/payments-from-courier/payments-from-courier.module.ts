import { Module } from '@nestjs/common';
import { PaymentsFromCourierService } from './payments-from-courier.service';
import { PaymentsFromCourierController } from './payments-from-courier.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsFromCourierEntity } from 'src/core/entity/payments.from.courier';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentsFromCourierEntity])],
  controllers: [PaymentsFromCourierController],
  providers: [PaymentsFromCourierService],
})
export class PaymentsFromCourierModule {}
