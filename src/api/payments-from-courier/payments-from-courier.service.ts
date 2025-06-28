import { PaymentsFromCourierEntity } from './../../core/entity/payments.from.courier';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePaymentsFromCourierDto } from './dto/create-payments-from-courier.dto';
import { UpdatePaymentsFromCourierDto } from './dto/update-payments-from-courier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { catchError } from 'src/infrastructure/lib/response';
import { PaymentMethod } from 'src/common/enums';

@Injectable()
export class PaymentsFromCourierService {
  constructor (
    @InjectRepository(PaymentsFromCourierEntity)
    private readonly paymentsFromCourierRepo: Repository<PaymentsFromCourierEntity>,
    private readonly dataSource: DataSource
  ) {}

  async create(createPaymentsFromCourierDto: CreatePaymentsFromCourierDto) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { courier_id, amount, payment_method, payment_date, comment, market_id } = createPaymentsFromCourierDto;

      if (payment_method === PaymentMethod.CLICK_TO_MARKET && ! market_id) {
        throw new BadRequestException("Click_to_market usulida seller_id bo'lishi shart va majburiy !!!");
      }

      const payment = this.paymentsFromCourierRepo.create({ courier_id, amount, payment_method, payment_date, comment, market_id: payment_method === PaymentMethod.CLICK_TO_MARKET ? market_id : null });

      const savedPayment = await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();
      return savedPayment;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error.message);
    } finally {
      await queryRunner.release();
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
