import { CashboxHistoryRepository } from './../../core/repository/cashbox-history.repository';
import { PaymentsFromCourierEntity } from './../../core/entity/payments.from.courier';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePaymentsFromCourierDto } from './dto/create-payments-from-courier.dto';
import { UpdatePaymentsFromCourierDto } from './dto/update-payments-from-courier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { catchError } from 'src/infrastructure/lib/response';
import { Operation_type, PaymentMethod, Source_type } from 'src/common/enums';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { PaymentFromCourierRepository } from 'src/core/repository/paymentfromcourier.repository';

@Injectable()
export class PaymentsFromCourierService {
  constructor (
    @InjectRepository(PaymentsFromCourierEntity)
    private readonly paymentsFromCourierRepo: PaymentFromCourierRepository,

    @InjectRepository(CashboxHistoryEntity)
    private readonly cashboxHistoryRepo: CashboxHistoryRepository,

    @InjectRepository(CashEntity)
    private readonly cashboxRepo: CashRepository,

    private readonly dataSource: DataSource
  ) {}

  async create(
    user: any,
    createPaymentsFromCourierDto: CreatePaymentsFromCourierDto) {
    const transaction = this.dataSource.createQueryRunner();

    await transaction.connect();
    
    
    await transaction.startTransaction();

    try {
      
      const { id } = user;
      const { courier_id, amount, payment_method, payment_date, comment, market_id } = createPaymentsFromCourierDto;

      if (payment_method === PaymentMethod.CLICK_TO_MARKET && ! market_id) {
        throw new BadRequestException("Click_to_market usulida seller_id bo'lishi shart va majburiy !!!");
      }

      const payment = this.paymentsFromCourierRepo.create({ courier_id, amount, payment_method, payment_date, comment, market_id: payment_method === PaymentMethod.CLICK_TO_MARKET ? market_id : null });
      const savedPayment = await transaction.manager.save(payment);

      const [cashbox] = await this.cashboxRepo.find();
      if (!cashbox) throw new BadRequestException("Kassa topilmadi!");

      
      cashbox.balance = Number(cashbox.balance) + amount;
      console.log(cashbox.balance);
      

      const updatedCashbox = await transaction.manager.save(CashEntity, cashbox);
      
      console.log(updatedCashbox, 1);
      console.log(savedPayment, 2);
      
      
      const incomeHistory = this.cashboxHistoryRepo.create({
        operation_type: Operation_type.INCOME,
        source_type: Source_type.COURIER_PAYMENT,
        source_id: savedPayment.id,
        amount: amount,
        balance_after: updatedCashbox.balance,
        comment,
        created_by: id
      })
      
      

      await transaction.manager.save(incomeHistory)
      console.log(incomeHistory, 3);

      // updatedCashbox.balance -= amount;
      
      // const minusCashbox = await transaction.manager.save(CashEntity, )
      
      await transaction.commitTransaction();
      return {"this is cashbox":cashbox, "updated":updatedCashbox}
      // return savedPayment;

    } catch (error) {
      await transaction.rollbackTransaction();
      return catchError(error.message);
    } finally {
      await transaction.release();
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
