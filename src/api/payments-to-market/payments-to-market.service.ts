import { IsDate } from 'class-validator';
import { MarketEntity } from './../../core/entity/market.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaymentsToMarketDto } from './dto/create-payments-to-market.dto';
import { UpdatePaymentsToMarketDto } from './dto/update-payments-to-market.dto';
import { PaymentsToMarketEntity } from 'src/core/entity/payments-to-market.entity';
import { PaymentsToMarketRepository } from 'src/core/repository/paymentstomarket.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { DataSource, In } from 'typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashboxHistoryRepository } from 'src/core/repository/cashbox-history.repository';
import {
  Cashbox_type,
  Operation_type,
  Order_status,
  Source_type,
  Status,
} from 'src/common/enums';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { MarketRepository } from 'src/core/repository/market.repository';

@Injectable()
export class PaymentsToMarketService {
  constructor(
    @InjectRepository(PaymentsToMarketEntity)
    private readonly paymentsToMarketRepo: PaymentsToMarketRepository,

    @InjectRepository(CashEntity)
    private readonly cashboxRepo: CashRepository,

    @InjectRepository(CashboxHistoryEntity)
    private readonly cashboxHistoryRepo: CashboxHistoryRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectRepository(MarketEntity)
    private readonly marketRepo: MarketRepository,

    private readonly datasource: DataSource,
  ) {}

  async create(
    user: any,
    createPaymentsToMarketDto: CreatePaymentsToMarketDto,
  ) {
    const transaction = this.datasource.createQueryRunner();
    await transaction.connect();
    await transaction.startTransaction();

    try {
      const { id } = user;
      const { market_id, payment_date, amount, comment } =
        createPaymentsToMarketDto;
      let paymentInProcess = amount;

      // 1. Main cashboxni topamiz
      const mainCashbox = await transaction.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });

      const marketCashbox = await transaction.manager.findOne(CashEntity, {
        where: {
          cashbox_type: Cashbox_type.FOR_MARKET,
          user_id: market_id,
        },
      });

      if (!mainCashbox) throw new NotFoundException('Main cashbox topilmadi');
      if (!marketCashbox)
        throw new NotFoundException('Market kassasi topilmadi');

      if (mainCashbox.balance < amount) {
        throw new Error("Asosiy kassada yetarli mablag' mavjud emas");
      }

      const allSoldOrders = await transaction.manager.find(OrderEntity, {
        where: {
          status: In([Order_status.SOLD, Order_status.PARTLY_PAID]),
          market_id,
        },
        order: { updated_at: 'ASC' },
      });

      const market = await transaction.manager.findOne(MarketEntity, {
        where: { id: market_id },
      });
      if (!market) throw new NotFoundException('Market not found');

      if (allSoldOrders.length > 0) {
        for (let i = 0; i < allSoldOrders.length; i++) {
          if (paymentInProcess >= allSoldOrders[i].to_be_paid) {
            paymentInProcess -= allSoldOrders[i].to_be_paid;
            await transaction.manager.update(
              OrderEntity,
              {
                id: allSoldOrders[i].id,
              },
              {
                paid_amount: allSoldOrders[i].to_be_paid,
                status: Order_status.PAID,
              },
            );
          } else {
            await transaction.manager.update(
              OrderEntity,
              {
                id: allSoldOrders[i].id,
              },
              {
                paid_amount: paymentInProcess,
                status: Order_status.PARTLY_PAID,
              },
            );
            paymentInProcess = 0;
            break;
          }
        }
      }

      mainCashbox.balance -= amount;
      await transaction.manager.save(mainCashbox);

      // 1.1 Main kassadan chiqqan pulni tarixga yozamiz
      const mainCashHistory = transaction.manager.create(CashboxHistoryEntity, {
        operation_type: Operation_type.EXPENSE,
        source_type: Source_type.MARKET_PAYMENT,
        source_id: market_id,
        amount,
        balance_after: mainCashbox.balance,
        comment: comment || "Pul marketga o'tkazildi",
        created_by: id,
        cashbox_id: mainCashbox.id,
      });

      await transaction.manager.save(mainCashHistory);

      // 2. Market kassasini topamiz

      marketCashbox.balance -= amount;
      await transaction.manager.save(marketCashbox);

      // 2.1 Market kassaga kirgan pulni tarixga yozamiz
      const marketCashHistory = transaction.manager.create(
        CashboxHistoryEntity,
        {
          operation_type: Operation_type.INCOME,
          source_type: Source_type.MARKET_PAYMENT,
          source_id: market_id,
          amount,
          balance_after: marketCashbox.balance,
          comment: comment || 'Marketga pul tushdi',
          created_by: id,
          cashbox_id: marketCashbox.id,
        },
      );

      await transaction.manager.save(marketCashHistory);

      // 3. Asosiy to‘lov yozuvi
      const payment = transaction.manager.create(PaymentsToMarketEntity, {
        market_id,
        amount,
        payment_date: payment_date || new Date().toISOString(),
        comment,
        created_by: id,
      });

      await transaction.manager.save(payment);

      await transaction.commitTransaction();
      return successRes(
        payment,
        200,
        `${amount} so'm marketga muvaffaqiyatli o'tkazildi`,
      );
    } catch (error) {
      await transaction.rollbackTransaction();
      return catchError(error.message);
    } finally {
      await transaction.release();
    }
  }

  async findAll() {
    try {
      const paymentToMarket = await this.paymentsToMarketRepo.find();
      return successRes(paymentToMarket);
    } catch (error) {
      return catchError(error.message);
    }
  }

  async findOne(id: string) {
    try {
      const paymentToMarket = await this.paymentsToMarketRepo.findOne({
        where: { id },
      });
      if (!paymentToMarket) {
        throw new NotFoundException('Payments to market not found by id', id);
      }
      return paymentToMarket;
    } catch (error) {
      return catchError(error.message);
    }
  }
}
