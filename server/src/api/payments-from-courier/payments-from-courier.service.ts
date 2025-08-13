import { CashboxHistoryRepository } from './../../core/repository/cashbox-history.repository';
import { PaymentsFromCourierEntity } from './../../core/entity/payments.from.courier';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePaymentsFromCourierDto } from './dto/create-payments-from-courier.dto';
import { UpdatePaymentsFromCourierDto } from './dto/update-payments-from-courier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import {
  Cashbox_type,
  Operation_type,
  PaymentMethod,
  Source_type,
} from 'src/common/enums';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { PaymentFromCourierRepository } from 'src/core/repository/paymentfromcourier.repository';

@Injectable()
export class PaymentsFromCourierService {
  constructor(
    @InjectRepository(PaymentsFromCourierEntity)
    private readonly paymentsFromCourierRepo: PaymentFromCourierRepository,

    @InjectRepository(CashboxHistoryEntity)
    private readonly cashboxHistoryRepo: CashboxHistoryRepository,

    @InjectRepository(CashEntity)
    private readonly cashboxRepo: CashRepository,

    private readonly dataSource: DataSource,
  ) {}

  async create(
    user: any,
    createPaymentsFromCourierDto: CreatePaymentsFromCourierDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { id } = user;
      const {
        courier_id,
        amount,
        payment_method,
        payment_date,
        comment,
        market_id,
      } = createPaymentsFromCourierDto;

      if (payment_method === PaymentMethod.CLICK_TO_MARKET && !market_id) {
        throw new BadRequestException(
          'CLICK TO MARKET usulida kimga click qilinganligi tanlanishi shart!!!',
        );
      }

      const payment = queryRunner.manager.create(PaymentsFromCourierEntity, {
        courier_id,
        amount,
        payment_method,
        payment_date,
        comment,
        market_id:
          payment_method === PaymentMethod.CLICK_TO_MARKET ? market_id : null,
      });
      const savedPayment = await queryRunner.manager.save(payment);

      const cashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!cashbox) throw new BadRequestException('Kassa topilmadi!');
      const courier_cashbox = await this.cashboxRepo.findOne({
        where: { user_id: courier_id },
      });
      if (!courier_cashbox)
        throw new BadRequestException('Courier kassasi topilmadi');

      courier_cashbox.balance -= amount;
      cashbox.balance += amount;

      await queryRunner.manager.save(CashEntity, courier_cashbox);
      const updatedCashbox = await queryRunner.manager.save(
        CashEntity,
        cashbox,
      );

      const incomeHistory = this.cashboxHistoryRepo.create({
        operation_type: Operation_type.INCOME,
        source_type: Source_type.COURIER_PAYMENT,
        source_id: savedPayment.id,
        amount: amount,
        balance_after: updatedCashbox.balance,
        comment,
        created_by: id,
      });

      await queryRunner.manager.save(incomeHistory);

      let outcomeHistory;

      if (
        payment_method === PaymentMethod.CLICK_TO_MARKET &&
        market_id != null
      ) {
        const market_cashbox = await this.cashboxRepo.findOne({
          where: { user_id: market_id },
        });

        if (!market_cashbox) {
          throw new NotFoundException('Market cashbox topilmadi');
        }

        cashbox.balance -= amount;

        market_cashbox.balance -= amount;

        const minusCashbox = await queryRunner.manager.save(
          CashEntity,
          cashbox,
        );
        await queryRunner.manager.save(CashEntity, market_cashbox);

        outcomeHistory = this.cashboxHistoryRepo.create({
          operation_type: Operation_type.INCOME,
          source_type: Source_type.COURIER_PAYMENT,
          source_id: savedPayment.id,
          amount: amount,
          balance_after: minusCashbox.balance,
          comment,
          created_by: id,
        });

        await queryRunner.manager.save(outcomeHistory);
      }

      await queryRunner.commitTransaction();
      return successRes(
        { income: incomeHistory, outcome: outcomeHistory },
        201,
        " To'lov qabul qilindi !!! ",
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Xatolik:', error);
      return catchError(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    try {
      const paymentsfromcouriers = await this.paymentsFromCourierRepo.find();
      return successRes(paymentsfromcouriers);
    } catch (error) {
      return catchError(error.message);
    }
  }

  async findOne(id: string) {
    try {
      const paymentfromcourier = await this.paymentsFromCourierRepo.findOne({
        where: { id },
      });
      if (!paymentfromcourier) {
        throw new NotFoundException(
          'Payments from courier not found by id: ',
          id,
        );
      }
      return successRes(paymentfromcourier);
    } catch (error) {
      return catchError(error.message);
    }
  }
}
