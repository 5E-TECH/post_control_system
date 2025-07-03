import { IsDate } from 'class-validator';
import { MarketEntity } from './../../core/entity/market.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaymentsToMarketDto } from './dto/create-payments-to-market.dto';
import { UpdatePaymentsToMarketDto } from './dto/update-payments-to-market.dto';
import { PaymentsToMarketEntity } from 'src/core/entity/payments-to-market.entity';
import { PaymentsToMarketRepository } from 'src/core/repository/paymentstomarket.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { DataSource } from 'typeorm';

@Injectable()
export class PaymentsToMarketService {
  constructor(
    @InjectRepository(PaymentsToMarketEntity)
    private readonly paymentsToMarketRepo: PaymentsToMarketRepository,
    private readonly datasource: DataSource
  ) {  }

  async create(
    user: any,
    createPaymentsToMarketDto: CreatePaymentsToMarketDto) {
    const transaction = this.datasource.createQueryRunner();

    await transaction.connect();

    await transaction.startTransaction();

    try {
      const { id } = user;
      const { market_id, amount, payment_date, comment } = createPaymentsToMarketDto;
    } catch (error) {
      return catchError(error.message)
    }
  }

  async findAll() {
    try {
      const paymentToMarket = await this.paymentsToMarketRepo.find()
      return successRes(paymentToMarket)
    } catch (error) {
      return catchError(error.message)
    }
  }

  async findOne(id: string) {
    try {
      const paymentToMarket = await this.paymentsToMarketRepo.findOne({ where: { id } })
      if(!paymentToMarket) {
        throw new NotFoundException('Payments to market not found by id', id)
      }
      return paymentToMarket;
    } catch (error) {
      return catchError(error.message)
    }
  }
}
