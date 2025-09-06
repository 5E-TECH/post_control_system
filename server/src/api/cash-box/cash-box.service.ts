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
import { catchError } from 'src/infrastructure/lib/response';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { DataSource, DeepPartial, In } from 'typeorm';
import {
  Cashbox_type,
  Operation_type,
  Order_status,
  PaymentMethod,
  Source_type,
} from 'src/common/enums';
import { successRes } from 'src/infrastructure/lib/response';
import { CreatePaymentsFromCourierDto } from './dto/payments-from-courier.dto';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashboxHistoryRepository } from 'src/core/repository/cashbox-history.repository';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { PaymentsToMarketDto } from './dto/payment-to-market.dto';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { MarketEntity } from 'src/core/entity/market.entity';
import { MarketRepository } from 'src/core/repository/market.repository';

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

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectRepository(MarketEntity)
    private readonly marketRepo: MarketRepository,

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

  async paymentsFromCourier(
    user: JwtPayload,
    createPaymentsFromCourierDto: CreatePaymentsFromCourierDto,
  ) {
    const transaction = this.dataSource.createQueryRunner();
    await transaction.connect();
    await transaction.startTransaction();
    try {
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
          "Click_to_market usulida market_id bo'lishi shart va majburiy !!!",
        );
      }

      const courierCashbox = await transaction.manager.findOne(CashEntity, {
        where: { user_id: courier_id },
      });
      if (!courierCashbox) {
        throw new NotFoundException('Courier cashbox not found');
      }

      const mainCashbox = await transaction.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      courierCashbox.balance -= amount;
      await transaction.manager.save(courierCashbox);

      const courierCashboxHistory = transaction.manager.create(
        CashboxHistoryEntity,
        {
          operation_type: Operation_type.EXPENSE,
          cashbox_id: courierCashbox.id,
          source_type: Source_type.COURIER_PAYMENT,
          amount,
          balance_after: courierCashbox.balance,
          comment,
          created_by: user.id,
          payment_date,
          payment_method,
        },
      ); // Davom etaman ......

      await transaction.manager.save(courierCashboxHistory);

      mainCashbox.balance += amount;
      await transaction.manager.save(mainCashbox);

      const mainCashboxHistory = transaction.manager.create(
        CashboxHistoryEntity,
        {
          operation_type: Operation_type.INCOME,
          cashbox_id: mainCashbox.id,
          source_type: Source_type.COURIER_PAYMENT,
          amount,
          balance_after: mainCashbox.balance,
          comment,
          created_by: user.id,
          payment_date,
          payment_method,
        },
      );
      await transaction.manager.save(mainCashboxHistory);

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
        // Davom etaman ..........

        mainCashbox.balance -= amount;
        await transaction.manager.save(mainCashbox);

        const mainCashboxHistoryMarket = transaction.manager.create(
          CashboxHistoryEntity,
          {
            operation_type: Operation_type.EXPENSE,
            cashbox_id: mainCashbox.id,
            source_type: Source_type.MARKET_PAYMENT,
            amount,
            balance_after: mainCashbox.balance,
            comment,
            created_by: user.id,
            payment_date,
            payment_method,
          },
        );
        await transaction.manager.save(mainCashboxHistoryMarket);

        market_cashbox.balance -= amount;
        await transaction.manager.save(market_cashbox);

        const marketCashboxHistory = await transaction.manager.create(
          CashboxHistoryEntity,
          {
            operation_type: Operation_type.EXPENSE,
            cashbox_id: market_cashbox.id,
            source_type: Source_type.MARKET_PAYMENT,
            amount,
            balance_after: market_cashbox.balance,
            comment,
            created_by: user.id,
            payment_date,
            payment_method,
          },
        );
        await transaction.manager.save(marketCashboxHistory);
      }

      await transaction.commitTransaction();
      return successRes({}, 201, "To'lov qabul qilindi !!! ");
    } catch (error) {
      await transaction.rollbackTransaction();
      console.error('Xatolik:', error);
      return catchError(error.message);
    } finally {
      await transaction.release();
    }
  }

  async paymentsToMarket(
    user: JwtPayload,
    paymentToMarketDto: PaymentsToMarketDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { amount, market_id, comment, payment_date, payment_method } =
        paymentToMarketDto;
      let paymentInProcess = amount;

      const market = await queryRunner.manager.findOne(MarketEntity, {
        where: { id: market_id },
      });
      if (!market) {
        throw new NotFoundException('Market you choose is not exist');
      }

      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      const marketCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: {
          market_id,
        },
      });
      if (!marketCashbox) {
        throw new NotFoundException('Market cashbox not found');
      }

      // Asosiy kassadagi mablag' kiritilgan qiymatdan ko'p bo'lsa jarayonga ruxsat berilmaydi
      if (Number(mainCashbox.balance) < Number(amount)) {
        throw new BadRequestException(`Asosiy kassada mablag' yetarli emas`);
      }

      // Barcha sotilgan yoki yarim sotilgan mahsulotlarni topish
      const allSoldOrders = await queryRunner.manager.find(OrderEntity, {
        where: {
          status: In([Order_status.SOLD, Order_status.PARTLY_PAID]),
          market_id,
        },
        order: { updated_at: 'ASC' },
      });

      // Main cashboxdan pul ayirish va history yozish
      mainCashbox.balance -= amount;
      await queryRunner.manager.save(mainCashbox);

      const mainCashboxHistory = queryRunner.manager.create(
        CashboxHistoryEntity,
        {
          operation_type: Operation_type.EXPENSE,
          cashbox_id: mainCashbox.id,
          source_type: Source_type.MARKET_PAYMENT,
          amount,
          balance_after: mainCashbox.balance,
          comment,
          created_by: user.id,
          payment_date,
          payment_method,
        },
      );
      await queryRunner.manager.save(mainCashboxHistory);

      // Pul yetgan barcha sotilgan mahsulotlarni paid yoki paryli_paid statusiga o'zgartirish
      for (let i = 0; i < allSoldOrders.length; i++) {
        if (paymentInProcess >= allSoldOrders[i].to_be_paid) {
          paymentInProcess -= allSoldOrders[i].to_be_paid;
          allSoldOrders[i].paid_amount = allSoldOrders[i].to_be_paid;
          allSoldOrders[i].status = Order_status.PAID;
          await queryRunner.manager.save(allSoldOrders[i]);
        } else {
          (allSoldOrders[i].paid_amount = paymentInProcess),
            (allSoldOrders[i].status = Order_status.PARTLY_PAID);
          await queryRunner.manager.save(allSoldOrders[i]);
          paymentInProcess = 0;
          break;
        }
      }

      // Market Cashboxdan pul ayirish va uni hisyoryga yozib quyish
      marketCashbox.balance -= amount;
      await queryRunner.manager.save(marketCashbox);

      const marketCashboxHistory = await queryRunner.manager.create(
        CashboxHistoryEntity,
        {
          operation_type: Operation_type.EXPENSE,
          cashbox_id: marketCashbox.id,
          source_type: Source_type.MARKET_PAYMENT,
          amount,
          balance_after: marketCashbox.balance,
          comment,
          created_by: user.id,
          payment_date,
          payment_method,
        },
      );
      await queryRunner.manager.save(marketCashboxHistory);

      await queryRunner.commitTransaction();
      return successRes({}, 200, `Marketga ${amount} so'm to'landi`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }
}
