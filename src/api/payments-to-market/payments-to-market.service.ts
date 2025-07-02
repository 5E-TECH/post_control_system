import { Injectable } from '@nestjs/common';
import { CreatePaymentsToMarketDto } from './dto/create-payments-to-market.dto';
import { UpdatePaymentsToMarketDto } from './dto/update-payments-to-market.dto';
import { PaymentsToMarketEntity } from 'src/core/entity/payments-to-market.entity';
import { PaymentsToMarketRepository } from 'src/core/repository/paymentstomarket.repository';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PaymentsToMarketService {
  constructor(
    @InjectRepository(PaymentsToMarketEntity)
    private readonly paymentsToMarketRepo: PaymentsToMarketRepository,
  ) {}

  create(createPaymentsToMarketDto: CreatePaymentsToMarketDto) {
    return 'This action adds a new paymentsToMarket';
  }

  async findAll() {
    // const paymentToMarket = await
  }

  findOne(id: number) {
    return `This action returns a #${id} paymentsToMarket`;
  }
}
