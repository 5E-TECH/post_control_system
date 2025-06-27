import { PaymentsFromCourierEntity } from './../../core/entity/payments.from.courier';
import { Injectable } from '@nestjs/common';
import { CreatePaymentsFromCourierDto } from './dto/create-payments-from-courier.dto';
import { UpdatePaymentsFromCourierDto } from './dto/update-payments-from-courier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { catchError } from 'src/infrastructure/lib/response';

@Injectable()
export class PaymentsFromCourierService {
  constructor (
    @InjectRepository(PaymentsFromCourierEntity)
    private readonly paymentsFromCourierRepo: Repository<PaymentsFromCourierEntity>,
  ) {}

  async create(createPaymentsFromCourierDto: CreatePaymentsFromCourierDto) {
    try {
    } catch (error) {
      return catchError(error.message)
    }
  }

  findAll() {
    return `This action returns all paymentsFromCourier`;
  }

  findOne(id: number) {
    return `This action returns a #${id} paymentsFromCourier`;
  }

  update(id: number, updatePaymentsFromCourierDto: UpdatePaymentsFromCourierDto) {
    return `This action updates a #${id} paymentsFromCourier`;
  }

  remove(id: number) {
    return `This action removes a #${id} paymentsFromCourier`;
  }
}
