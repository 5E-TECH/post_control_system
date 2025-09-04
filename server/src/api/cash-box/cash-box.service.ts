import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { CreateCashBoxDto } from './dto/create-cash-box.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { catchError } from 'rxjs';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { DataSource, DeepPartial } from 'typeorm';
import {
  Cashbox_type,
  Operation_type,
  PaymentMethod,
  Source_type,
} from 'src/common/enums';
import { successRes } from 'src/infrastructure/lib/response';
import { CreatePaymentsFromCourierDto } from './dto/payments-from-courier.dto';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashboxHistoryRepository } from 'src/core/repository/cashbox-history.repository';
import { JwtPayload } from 'src/common/utils/types/user.type';

@Injectable()
export class CashBoxService
  extends BaseService<CreateCashBoxDto, DeepPartial<CashEntity>>
  implements OnModuleInit
{
  constructor(
    @InjectRepository(CashEntity)
    private readonly cashboxRepo: CashRepository,

    @InjectRepository(CashboxHistoryEntity)
    private readonly cashboxHistoryRepo: CashboxHistoryRepository,

    private readonly dataSource: DataSource,
  ) {
    super(cashboxRepo);
  }

  async onModuleInit() {
    try {
      const existsCashe = await this.cashboxRepo.find();

      if (existsCashe.length == 0) {
        const cashe = this.cashboxRepo.create({
          cashbox_type: Cashbox_type.MAIN,
        });
        await this.cashboxRepo.save(cashe);
        console.log('Initial cashbox created');
      }
    } catch (error) {
      return catchError(error);
    }
  }

  // async paymentsFromCourier(
  //   user: JwtPayload,
  //   createPaymentsFromCourierDto: CreatePaymentsFromCourierDto,
  // ) {
  //   const transaction = this.dataSource.createQueryRunner();
  //   await transaction.connect();
  //   await transaction.startTransaction();

  //   try {
  //     const {
  //       courier_id,
  //       amount,
  //       payment_method,
  //       payment_date,
  //       comment,
  //       market_id,
  //     } = createPaymentsFromCourierDto;

  //     if (payment_method === PaymentMethod.CLICK_TO_MARKET && !market_id) {
  //       throw new BadRequestException(
  //         "Click_to_market usulida market_id bo'lishi shart va majburiy !!!",
  //       );
  //     }

  //     const courierCashbox = await transaction.manager.findOne(CashEntity, {
  //       where: { user_id: courier_id },
  //     });
  //     if (!courierCashbox) {
  //       throw new NotFoundException('Courier cashbox not found');
  //     }

  //     const mainCashbox = await transaction.manager.findOne(CashEntity, {
  //       where: { cashbox_type: Cashbox_type.MAIN },
  //     });
  //     if (!mainCashbox) {
  //       throw new NotFoundException('Main cashbox not found');
  //     }

  //     courierCashbox.balance -= amount;
  //     const courierCashboxHistory = transaction.manager.create(
  //       CashboxHistoryEntity,
  //       {
  //         operation_type: Operation_type.EXPENSE,
  //         amount,
  //         balance_after: courierCashbox.balance,
  //         cashbox_id: courierCashbox.id,
  //         comment,
  //         created_by: user.id,

  //       },
  //     ); // Davom etaman ......

  //     const payment = this.cashboxHistoryRepo.create({
  //       courier_id,
  //       amount,
  //       payment_method,
  //       payment_date,
  //       comment,
  //       market_id:
  //         payment_method === PaymentMethod.CLICK_TO_MARKET ? market_id : null,
  //     });
  //     const savedPayment = await transaction.manager.save(payment);

  //     if (!cashbox) throw new BadRequestException('Kassa topilmadi!');
  //     const courier_cashbox = await this.cashboxRepo.findOne({
  //       where: { user_id: courier_id },
  //     });
  //     if (!courier_cashbox)
  //       throw new BadRequestException('Courier kassasi topilmadi');

  //     courier_cashbox.balance -= amount;
  //     cashbox.balance += amount;

  //     await transaction.manager.save(CashEntity, courier_cashbox);
  //     const updatedCashbox = await transaction.manager.save(
  //       CashEntity,
  //       cashbox,
  //     );

  //     const incomeHistory = this.cashboxHistoryRepo.create({
  //       operation_type: Operation_type.INCOME,
  //       source_type: Source_type.COURIER_PAYMENT,
  //       source_id: savedPayment.id,
  //       amount: amount,
  //       balance_after: updatedCashbox.balance,
  //       comment,
  //       created_by: id,
  //     });

  //     await transaction.manager.save(incomeHistory);

  //     let outcomeHistory;

  //     if (
  //       payment_method === PaymentMethod.CLICK_TO_MARKET &&
  //       market_id != null
  //     ) {
  //       const market_cashbox = await this.cashboxRepo.findOne({
  //         where: { user_id: market_id },
  //       });

  //       if (!market_cashbox) {
  //         throw new NotFoundException('Market cashbox topilmadi');
  //       }

  //       cashbox.balance -= amount;

  //       market_cashbox.balance -= amount;

  //       const minusCashbox = await transaction.manager.save(
  //         CashEntity,
  //         cashbox,
  //       );
  //       await transaction.manager.save(CashEntity, market_cashbox);

  //       outcomeHistory = this.cashboxHistoryRepo.create({
  //         operation_type: Operation_type.INCOME,
  //         source_type: Source_type.COURIER_PAYMENT,
  //         source_id: savedPayment.id,
  //         amount: amount,
  //         balance_after: minusCashbox.balance,
  //         comment,
  //         created_by: id,
  //       });

  //       await transaction.manager.save(outcomeHistory);
  //     }

  //     await transaction.commitTransaction();
  //     return successRes(
  //       { income: incomeHistory, outcome: outcomeHistory },
  //       201,
  //       " To'lov qabul qilindi !!! ",
  //     );
  //   } catch (error) {
  //     await transaction.rollbackTransaction();
  //     console.error('Xatolik:', error);
  //     return catchError(error.message);
  //   } finally {
  //     await transaction.release();
  //   }
  // }
}
