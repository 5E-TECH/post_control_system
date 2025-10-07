import { Module } from '@nestjs/common';
import { PrinterService } from './printer.service';
import { PrinterController } from './printer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity])],
  controllers: [PrinterController],
  providers: [PrinterService],
})
export class PrinterModule {}
