import { Injectable } from '@nestjs/common';
import { CreatePaymentsToMarketDto } from './dto/create-payments-to-market.dto';
import { UpdatePaymentsToMarketDto } from './dto/update-payments-to-market.dto';

@Injectable()
export class PaymentsToMarketService {
  create(createPaymentsToMarketDto: CreatePaymentsToMarketDto) {
    return 'This action adds a new paymentsToMarket';
  }

  findAll() {
    return `This action returns all paymentsToMarket`;
  }

  findOne(id: number) {
    return `This action returns a #${id} paymentsToMarket`;
  }

  update(id: number, updatePaymentsToMarketDto: UpdatePaymentsToMarketDto) {
    return `This action updates a #${id} paymentsToMarket`;
  }

  remove(id: number) {
    return `This action removes a #${id} paymentsToMarket`;
  }
}
