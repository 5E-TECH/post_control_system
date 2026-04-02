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
import {
  Between,
  DataSource,
  DeepPartial,
  In,
  IsNull,
  Repository,
} from 'typeorm';
import {
  Cashbox_type,
  FinancialSource_type,
  Operation_type,
  Order_status,
  PaymentMethod,
  Roles,
  Source_type,
} from 'src/common/enums';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { calculateFinancialBalance } from 'src/common/utils/financial-balance.util';
import { successRes } from 'src/infrastructure/lib/response';
import { CreatePaymentsFromCourierDto } from './dto/payments-from-courier.dto';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashboxHistoryRepository } from 'src/core/repository/cashbox-history.repository';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { PaymentsToMarketDto } from './dto/payment-to-market.dto';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import { UpdateCashBoxDto } from './dto/update-cash-box.dto';
import { SalaryDto } from './dto/salary.dto';
import { UserSalaryEntity } from 'src/core/entity/user-salary.entity';
import {
  getUzbekistanDayRange,
  toUzbekistanTimestamp,
} from 'src/common/utils/date.util';
import * as ExcelJS from 'exceljs';
import { ShiftEntity, ShiftStatus } from 'src/core/entity/shift.entity';
import { ShiftRepository } from 'src/core/repository/shift.repository';
import { getSafeLimit } from 'src/common/constants/pagination';
import { ActivityLogService } from '../activity-log/activity-log.service';

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

    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(ShiftEntity)
    private readonly shiftRepo: ShiftRepository,

    @InjectRepository(FinancialBalanceHistoryEntity)
    private readonly financialHistoryRepo: Repository<FinancialBalanceHistoryEntity>,

    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
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
      }
    } catch (error) {
      return catchError(error);
    }
  }

  async getMainCashbox(filters?: { fromDate?: string; toDate?: string }) {
    try {
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });

      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      let startDate = filters?.fromDate;
      let endDate = filters?.toDate;

      if (!startDate || !endDate) {
        // Sana berilmagan bo‘lsa — bugungi O‘zbekiston kuni
        const { start, end } = getUzbekistanDayRange();
        startDate = String(start);
        endDate = String(end);
      } else {
        // Ikkalasi bir xil bo‘lsa — 00:00 dan 23:59 gacha olish kerak
        if (startDate === endDate) {
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        } else {
          // Har xil kunlar oralig‘i
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        }
      }

      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: {
          cashbox_id: mainCashbox.id,
          created_at: Between(Number(startDate), Number(endDate)), // bigint timestamp
        },
        relations: ['createdByUser', 'sourceUser'],
        order: { created_at: 'DESC' },
      });

      let income = 0;
      let outcome = 0;

      for (const history of cashboxHistory) {
        if (history.operation_type === Operation_type.INCOME) {
          income += history.amount ?? 0;
        } else {
          outcome += history.amount ?? 0;
        }
      }

      return successRes(
        { cashbox: mainCashbox, cashboxHistory, income, outcome },
        200,
        'Main cashbox details',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Barcha main cashbox tarixini olish (sana filtersiz)
   */
  private async getAllMainCashboxHistory() {
    const mainCashbox = await this.cashboxRepo.findOne({
      where: { cashbox_type: Cashbox_type.MAIN },
    });
    if (!mainCashbox) {
      throw new NotFoundException('Main cashbox not found');
    }

    const cashboxHistory = await this.cashboxHistoryRepo.find({
      where: { cashbox_id: mainCashbox.id },
      relations: ['createdByUser', 'sourceUser'],
      order: { created_at: 'DESC' },
    });

    let income = 0;
    let outcome = 0;
    for (const history of cashboxHistory) {
      if (history.operation_type === Operation_type.INCOME) {
        income += history.amount ?? 0;
      } else {
        outcome += history.amount ?? 0;
      }
    }

    return successRes(
      { cashbox: mainCashbox, cashboxHistory, income, outcome },
      200,
      'All main cashbox history',
    );
  }

  async getCashboxByUserId(
    id: string,
    filters?: { fromDate?: string; toDate?: string; sourceTypes?: string },
  ) {
    try {
      const user = await this.userRepo.findOne({
        where: { id },
        relations: ['region'],
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const cashbox = await this.cashboxRepo.findOne({
        where: { user_id: id },
        relations: ['user'],
      });
      if (!cashbox) {
        throw new NotFoundException('Cashbox not found');
      }

      // vaqt oralig‘ini hisoblash (bigint timestamp)
      let startDate = filters?.fromDate;
      let endDate = filters?.toDate;

      if (!startDate || !endDate) {
        // Sana berilmagan bo‘lsa — bugungi O‘zbekiston kuni
        const { start, end } = getUzbekistanDayRange();
        startDate = String(start);
        endDate = String(end);
      } else {
        // Ikkalasi bir xil bo‘lsa — 00:00 dan 23:59 gacha olish kerak
        if (startDate === endDate) {
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        } else {
          // Har xil kunlar oralig‘i
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        }
      }

      // source_type filter
      const whereCondition: any = {
        cashbox_id: cashbox.id,
        created_at: Between(Number(startDate), Number(endDate)),
      };
      if (filters?.sourceTypes) {
        whereCondition.source_type = In(filters.sourceTypes.split(','));
      }

      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: whereCondition,
        relations: ['createdByUser'],
        order: { created_at: 'DESC' },
      });

      let income = 0;
      let outcome = 0;

      for (const history of cashboxHistory) {
        if (history.operation_type === Operation_type.INCOME) {
          income += history.amount ?? 0;
        } else {
          outcome += history.amount ?? 0;
        }
      }

      return successRes(
        { cashbox, cashboxHistory, income, outcome },
        200,
        'Cashbox details',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async myCashbox(
    user: JwtPayload,
    filters?: { fromDate?: string; toDate?: string; sourceTypes?: string },
  ) {
    try {
      const myCashbox = await this.cashboxRepo.findOne({
        where: { user_id: user.id },
      });
      if (!myCashbox) {
        throw new NotFoundException('Cashbox not found');
      }

      // vaqt oralig‘ini aniqlash
      let startDate = filters?.fromDate;
      let endDate = filters?.toDate;

      if (!startDate || !endDate) {
        // Sana berilmagan bo‘lsa — bugungi O‘zbekiston kuni
        const { start, end } = getUzbekistanDayRange();
        startDate = String(start);
        endDate = String(end);
      } else {
        // Ikkalasi bir xil bo‘lsa — 00:00 dan 23:59 gacha olish kerak
        if (startDate === endDate) {
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        } else {
          // Har xil kunlar oralig‘i
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        }
      }

      // source_type filter
      const whereCondition: any = {
        cashbox_id: myCashbox.id,
        created_at: Between(Number(startDate), Number(endDate)),
      };
      if (filters?.sourceTypes) {
        whereCondition.source_type = In(filters.sourceTypes.split(','));
      }

      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: whereCondition,
        relations: ['createdByUser'],
        order: { created_at: 'DESC' },
      });

      let income = 0;
      let outcome = 0;

      for (const history of cashboxHistory) {
        if (history.operation_type === Operation_type.INCOME) {
          income += history.amount ?? 0;
        } else {
          outcome += history.amount ?? 0;
        }
      }

      return successRes(
        { myCashbox, cashboxHistory, income, outcome },
        200,
        'My cashbox details',
      );
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
        where: { user_id: courier_id, cashbox_type: Cashbox_type.FOR_COURIER },
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
      );

      await transaction.manager.save(courierCashboxHistory);

      mainCashbox.balance += amount;
      // Naqd yoki karta balansini yangilash
      if (payment_method === PaymentMethod.CASH) {
        mainCashbox.balance_cash += amount;
      } else {
        mainCashbox.balance_card += amount;
      }
      await transaction.manager.save(mainCashbox);

      const mainCashboxHistory = transaction.manager.create(
        CashboxHistoryEntity,
        {
          operation_type: Operation_type.INCOME,
          cashbox_id: mainCashbox.id,
          source_type: Source_type.COURIER_PAYMENT,
          source_user_id: courier_id, // Store courier ID for tracking
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
        const market_cashbox = await transaction.manager.findOne(CashEntity, {
          where: { user_id: market_id, cashbox_type: Cashbox_type.FOR_MARKET },
        });

        if (!market_cashbox) {
          throw new NotFoundException('Market cashbox topilmadi');
        }

        const allSoldOrders = await this.orderRepo
          .createQueryBuilder('o')
          .where('o.user_id = :market_id', { market_id })
          .andWhere('o.status IN (:...statuses)', {
            statuses: [Order_status.PARTLY_PAID, Order_status.SOLD],
          })
          .orderBy(
            `
    CASE 
      WHEN o.status = '${Order_status.PARTLY_PAID}' THEN 1
      WHEN o.status = '${Order_status.SOLD}' THEN 2
    END
  `,
          )
          .addOrderBy('o.updated_at', 'ASC')
          .getMany();

        mainCashbox.balance -= amount;
        // CLICK_TO_MARKET da kartadan chiqim
        mainCashbox.balance_card -= amount;
        await transaction.manager.save(mainCashbox);

        const mainCashboxHistoryMarket = transaction.manager.create(
          CashboxHistoryEntity,
          {
            operation_type: Operation_type.EXPENSE,
            cashbox_id: mainCashbox.id,
            source_type: Source_type.MARKET_PAYMENT,
            source_user_id: market_id, // Store market ID for tracking
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

        const marketCashboxHistory = transaction.manager.create(
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

        let paymentInProcess = amount;

        // 1. Avval PARTLY_PAID bo'lgan orderni topamiz (agar bo'lsa)
        const partlyPaidOrder = allSoldOrders.find(
          (o) => o.status === Order_status.PARTLY_PAID,
        );

        if (partlyPaidOrder && paymentInProcess > 0) {
          const remaining =
            partlyPaidOrder.to_be_paid - partlyPaidOrder.paid_amount;
          if (paymentInProcess >= remaining) {
            paymentInProcess -= remaining;
            partlyPaidOrder.paid_amount = partlyPaidOrder.to_be_paid;
            partlyPaidOrder.status = Order_status.PAID;
          } else {
            partlyPaidOrder.paid_amount += paymentInProcess;
            partlyPaidOrder.status = Order_status.PARTLY_PAID;
            paymentInProcess = 0;
          }
          await transaction.manager.save(partlyPaidOrder);
        }

        // 2. Qolgan SOLD orderlarni ketma-ket to'laymiz
        const soldOrders = allSoldOrders.filter(
          (o) => o.status === Order_status.SOLD,
        );

        for (const order of soldOrders) {
          if (paymentInProcess <= 0) break;

          if (paymentInProcess >= order.to_be_paid) {
            paymentInProcess -= order.to_be_paid;
            order.paid_amount = order.to_be_paid;
            order.status = Order_status.PAID;
          } else {
            order.paid_amount = paymentInProcess;
            order.status = Order_status.PARTLY_PAID;
            paymentInProcess = 0;
          }
          await transaction.manager.save(order);
        }
      }

      await transaction.commitTransaction();
      this.activityLog.log({
        entity_type: 'cashbox',
        entity_id: createPaymentsFromCourierDto.courier_id,
        action: 'courier_payment',
        new_value: { amount: createPaymentsFromCourierDto.amount, payment_method: createPaymentsFromCourierDto.payment_method },
        description: `Kuryerdan ${createPaymentsFromCourierDto.amount} so'm qabul qilindi (${createPaymentsFromCourierDto.payment_method})`,
        user,
      });
      return successRes({}, 201, "To'lov qabul qilindi !!! ");
    } catch (error) {
      await transaction.rollbackTransaction();
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

      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: market_id, role: Roles.MARKET },
      });
      if (!market) throw new NotFoundException('Market not found');

      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');

      const marketCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { user_id: market_id, cashbox_type: Cashbox_type.FOR_MARKET },
      });
      if (!marketCashbox)
        throw new NotFoundException('Market cashbox not found');

      // Naqd yoki karta balansini tekshirish
      if (payment_method === PaymentMethod.CASH) {
        if (mainCashbox.balance_cash < amount) {
          throw new BadRequestException(
            `Naqd kassada yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_cash.toLocaleString()} so'm, So'ralgan: ${amount.toLocaleString()} so'm`,
          );
        }
      } else {
        if (mainCashbox.balance_card < amount) {
          throw new BadRequestException(
            `Karta/Click balansida yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_card.toLocaleString()} so'm, So'ralgan: ${amount.toLocaleString()} so'm`,
          );
        }
      }

      const allSoldOrders = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.user_id = :market_id', { market_id })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [Order_status.PARTLY_PAID, Order_status.SOLD],
        })
        .orderBy(
          `
    CASE 
      WHEN o.status = '${Order_status.PARTLY_PAID}' THEN 1
      WHEN o.status = '${Order_status.SOLD}' THEN 2
    END
  `,
        )
        .addOrderBy('o.updated_at', 'ASC')
        .getMany();

      // ✅ Main cashboxdan pul ayirish
      mainCashbox.balance -= amount;
      // Naqd yoki karta balansini yangilash
      if (payment_method === PaymentMethod.CASH) {
        mainCashbox.balance_cash -= amount;
      } else {
        mainCashbox.balance_card -= amount;
      }
      await queryRunner.manager.save(mainCashbox);

      await queryRunner.manager.save(
        queryRunner.manager.create(CashboxHistoryEntity, {
          operation_type: Operation_type.EXPENSE,
          cashbox_id: mainCashbox.id,
          source_type: Source_type.MARKET_PAYMENT,
          source_user_id: market_id, // Store market ID for tracking
          amount,
          balance_after: mainCashbox.balance,
          comment,
          created_by: user.id,
          payment_date,
          payment_method,
        }),
      );

      // ✅ Orderlarni yopish
      for (let i = 0; i < allSoldOrders.length && paymentInProcess > 0; i++) {
        const order = allSoldOrders[i];
        const remaining = order.to_be_paid - order.paid_amount;

        if (paymentInProcess >= remaining) {
          // To‘liq yopiladi
          order.paid_amount += remaining;
          order.status = Order_status.PAID;
          paymentInProcess -= remaining;
        } else {
          // Qisman yopiladi
          order.paid_amount += paymentInProcess;
          order.status = Order_status.PARTLY_PAID;
          paymentInProcess = 0;
        }

        await queryRunner.manager.save(order);
      }

      // ✅ Market cashboxdan pul ayirish
      marketCashbox.balance -= amount;
      await queryRunner.manager.save(marketCashbox);

      await queryRunner.manager.save(
        queryRunner.manager.create(CashboxHistoryEntity, {
          operation_type: Operation_type.EXPENSE,
          cashbox_id: marketCashbox.id,
          source_type: Source_type.MARKET_PAYMENT,
          amount,
          balance_after: marketCashbox.balance,
          comment,
          created_by: user.id,
          payment_date,
          payment_method,
        }),
      );

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'cashbox',
        entity_id: market_id,
        action: 'market_payment',
        new_value: { amount, payment_method },
        description: `Marketga ${amount} so'm to'landi (${payment_method})`,
        user,
      });
      return successRes({}, 200, `Marketga ${amount} so'm to'landi`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async financialBalance() {
    try {
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');
      const mainBalance: object = {
        cashboxId: mainCashbox?.id,
        balance: mainCashbox?.balance,
      };

      const allCourierCashboxes = await this.cashboxRepo.find({
        where: { cashbox_type: Cashbox_type.FOR_COURIER },
        relations: ['user', 'user.region'],
      });
      let courierBalanses: object[] = [];
      let couriersTotalBalanse: number = 0;
      for (const cashbox of allCourierCashboxes) {
        courierBalanses.push({
          userId: cashbox.user_id,
          name: cashbox.user.name,
          region: cashbox.user.region,
          balance: cashbox.balance,
        });
        couriersTotalBalanse += Number(cashbox.balance);
      }

      const allMarketCashboxes = await this.cashboxRepo.find({
        where: { cashbox_type: Cashbox_type.FOR_MARKET },
        relations: ['user'],
      });
      let marketCashboxes: object[] = [];
      let marketsTotalBalans: number = 0;
      for (const cashbox of allMarketCashboxes) {
        marketCashboxes.push({
          userId: cashbox.user_id,
          name: cashbox.user.name,
          balance: -Number(cashbox.balance),
        });
        marketsTotalBalans -= Number(cashbox.balance);
      }

      const difference: number = couriersTotalBalanse + marketsTotalBalans;
      const currentSituation = Number(mainCashbox.balance) + difference;
      return successRes(
        {
          currentSituation,
          main: mainCashbox,
          markets: { allMarketCashboxes, marketsTotalBalans },
          couriers: { allCourierCashboxes, couriersTotalBalanse },
          difference,
        },
        200,
        'Financial balance infos',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== FINANCIAL BALANCE HISTORY ====================

  async financialBalanceHistory(filters?: {
    fromDate?: string;
    toDate?: string;
    sourceType?: FinancialSource_type;
    page?: number;
    limit?: number;
  }) {
    try {
      const currentBalance = await calculateFinancialBalance(this.dataSource.manager);

      const page = filters?.page && filters.page > 0 ? filters.page : 1;
      const limit = getSafeLimit(filters?.limit);
      const skip = (page - 1) * limit;

      let fromTs: number | null = null;
      let toTs: number | null = null;

      if (filters?.fromDate) {
        fromTs = toUzbekistanTimestamp(filters.fromDate, false);
      }
      if (filters?.toDate) {
        toTs = toUzbekistanTimestamp(filters.toDate, true);
      }

      const qb = this.financialHistoryRepo
        .createQueryBuilder('h')
        .leftJoinAndSelect('h.createdByUser', 'createdByUser')
        .leftJoinAndSelect('h.relatedUser', 'relatedUser')
        .leftJoinAndSelect('h.order', 'order')
        .orderBy('h.created_at', 'DESC')
        .skip(skip)
        .take(limit);

      if (fromTs !== null) {
        qb.andWhere('h.created_at >= :fromTs', { fromTs });
      }
      if (toTs !== null) {
        qb.andWhere('h.created_at <= :toTs', { toTs });
      }
      if (filters?.sourceType) {
        qb.andWhere('h.source_type = :sourceType', {
          sourceType: filters.sourceType,
        });
      }

      const [histories, total] = await qb.getManyAndCount();

      const historyData = histories.map((h) => ({
        id: h.id,
        created_at: h.created_at,
        source_type: h.source_type,
        amount: h.amount,
        balance_before: h.balance_before,
        balance_after: h.balance_after,
        comment: h.comment,
        created_by: h.createdByUser
          ? { id: h.createdByUser.id, name: h.createdByUser.name }
          : null,
        related_user: h.relatedUser
          ? { id: h.relatedUser.id, name: h.relatedUser.name, role: h.relatedUser.role }
          : null,
        order: h.order
          ? { id: h.order.id, total_price: h.order.total_price }
          : null,
      }));

      return successRes(
        {
          currentBalance,
          history: historyData,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        200,
        'Financial balance history',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== FINANCIAL BALANCE ANALYTICS ====================

  async financialBalanceAnalytics(filters?: {
    fromDate?: string;
    toDate?: string;
  }) {
    try {
      const currentBalance = await calculateFinancialBalance(this.dataSource.manager);

      let fromTs: number | null = null;
      let toTs: number | null = null;

      if (filters?.fromDate) {
        fromTs = toUzbekistanTimestamp(filters.fromDate, false);
      }
      if (filters?.toDate) {
        toTs = toUzbekistanTimestamp(filters.toDate, true);
      }

      // === 1. Source type bo'yicha guruhlash ===
      const sourceQb = this.financialHistoryRepo
        .createQueryBuilder('h')
        .select('h.source_type', 'source_type')
        .addSelect('SUM(CASE WHEN h.amount > 0 THEN h.amount ELSE 0 END)', 'positive_total')
        .addSelect('SUM(CASE WHEN h.amount < 0 THEN (-1 * h.amount) ELSE 0 END)', 'negative_total')
        .addSelect('SUM(h.amount)', 'net_total')
        .addSelect('COUNT(h.id)', 'transaction_count')
        .groupBy('h.source_type')
        .orderBy('net_total', 'DESC');

      if (fromTs !== null) {
        sourceQb.andWhere('h.created_at >= :fromTs', { fromTs });
      }
      if (toTs !== null) {
        sourceQb.andWhere('h.created_at <= :toTs', { toTs });
      }

      const sourceBreakdown = await sourceQb.getRawMany();

      // === 2. Umumiy statistika ===
      const totalsQb = this.financialHistoryRepo
        .createQueryBuilder('h')
        .select('SUM(CASE WHEN h.amount > 0 THEN h.amount ELSE 0 END)', 'total_positive')
        .addSelect('SUM(CASE WHEN h.amount < 0 THEN (-1 * h.amount) ELSE 0 END)', 'total_negative')
        .addSelect('SUM(h.amount)', 'net_change')
        .addSelect('COUNT(h.id)', 'total_count');

      if (fromTs !== null) {
        totalsQb.andWhere('h.created_at >= :fromTs', { fromTs });
      }
      if (toTs !== null) {
        totalsQb.andWhere('h.created_at <= :toTs', { toTs });
      }

      const totalsRaw = await totalsQb.getRawOne();
      const totalPositive = Number(totalsRaw?.total_positive ?? 0);
      const totalNegative = Number(totalsRaw?.total_negative ?? 0);
      const netChange = Number(totalsRaw?.net_change ?? 0);
      const totalCount = Number(totalsRaw?.total_count ?? 0);

      // === 3. Musbat ta'sir (+ tomonlama) ===
      const positiveImpact = sourceBreakdown
        .filter((s) => Number(s.positive_total) > 0)
        .map((s) => ({
          source_type: s.source_type,
          total_amount: Number(s.positive_total),
          transaction_count: Number(s.transaction_count),
          percentage: totalPositive > 0
            ? Math.round((Number(s.positive_total) / totalPositive) * 10000) / 100
            : 0,
        }))
        .sort((a, b) => b.total_amount - a.total_amount);

      // === 4. Manfiy ta'sir (- tomonlama) ===
      const negativeImpact = sourceBreakdown
        .filter((s) => Number(s.negative_total) > 0)
        .map((s) => ({
          source_type: s.source_type,
          total_amount: Number(s.negative_total),
          transaction_count: Number(s.transaction_count),
          percentage: totalNegative > 0
            ? Math.round((Number(s.negative_total) / totalNegative) * 10000) / 100
            : 0,
        }))
        .sort((a, b) => b.total_amount - a.total_amount);

      // === 5. Top 10 eng katta ta'sir ===
      const topQb = this.financialHistoryRepo
        .createQueryBuilder('h')
        .leftJoinAndSelect('h.createdByUser', 'createdByUser')
        .leftJoinAndSelect('h.relatedUser', 'relatedUser')
        .addSelect('CASE WHEN h.amount >= 0 THEN h.amount ELSE (-1 * h.amount) END', 'abs_amount')
        .orderBy('abs_amount', 'DESC')
        .take(10);

      if (fromTs !== null) {
        topQb.andWhere('h.created_at >= :fromTs', { fromTs });
      }
      if (toTs !== null) {
        topQb.andWhere('h.created_at <= :toTs', { toTs });
      }

      const topTransactions = await topQb.getMany();

      return successRes(
        {
          currentBalance,
          summary: {
            totalPositive,
            totalNegative,
            netChange,
            totalCount,
          },
          positiveImpact,
          negativeImpact,
          topTransactions: topTransactions.map((h) => ({
            id: h.id,
            created_at: h.created_at,
            source_type: h.source_type,
            amount: h.amount,
            balance_before: h.balance_before,
            balance_after: h.balance_after,
            comment: h.comment,
            created_by: h.createdByUser
              ? { id: h.createdByUser.id, name: h.createdByUser.name }
              : null,
            related_user: h.relatedUser
              ? { id: h.relatedUser.id, name: h.relatedUser.name, role: h.relatedUser.role }
              : null,
          })),
        },
        200,
        'Financial balance analytics',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async allCashboxesTotal(filters?: {
    operationType?: Operation_type;
    sourceType?: Source_type;
    createdBy?: string;
    cashboxType?: Cashbox_type;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
    fetchAll?: boolean;
  }) {
    try {
      // 1️⃣ Main, courier and market cashboxes
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');

      const courierCashboxes = await this.cashboxRepo.find({
        where: { cashbox_type: Cashbox_type.FOR_COURIER },
      });

      const marketCashboxes = await this.cashboxRepo.find({
        where: { cashbox_type: Cashbox_type.FOR_MARKET },
      });

      // 2️⃣ Pagination
      const page = filters?.page && filters.page > 0 ? filters.page : 1;
      const limit = getSafeLimit(filters?.limit, filters?.fetchAll);
      const skip = (page - 1) * limit;

      // 3️⃣ Build query
      const qb = this.cashboxHistoryRepo
        .createQueryBuilder('h')
        .leftJoinAndSelect('h.createdByUser', 'createdByUser')
        .leftJoinAndSelect('h.cashbox', 'cashbox')
        .orderBy('h.created_at', 'DESC')
        .skip(skip)
        .take(limit);

      // date filters
      let fromDate: number | null = null;
      let toDate: number | null = null;

      if (filters?.fromDate) {
        fromDate = toUzbekistanTimestamp(filters.fromDate, false);
      }
      if (filters?.toDate) {
        toDate = toUzbekistanTimestamp(filters.toDate, true);
      }

      // qb.andWhere('h.created_at BETWEEN :fromDate AND :toDate', {
      //   fromDate,
      //   toDate,
      // });

      // operation type
      if (filters?.operationType) {
        qb.andWhere('h.operation_type = :operationType', {
          operationType: filters.operationType,
        });
      }

      // source type
      if (filters?.sourceType) {
        qb.andWhere('h.source_type = :sourceType', {
          sourceType: filters.sourceType,
        });
      }

      // createdBy (user id)
      if (filters?.createdBy) {
        qb.andWhere('h.created_by = :createdBy', {
          createdBy: filters.createdBy,
        });
      }

      // cashbox type
      if (filters?.cashboxType) {
        qb.andWhere('cashbox.cashbox_type = :cashboxType', {
          cashboxType: filters.cashboxType,
        });
      }

      // 4️⃣ Execute query
      const [allCashboxHistories, total] = await qb.getManyAndCount();

      // 5️⃣ Totals
      let courierCashboxTotal = 0;
      let marketCashboxTotal = 0;
      for (const cashbox of courierCashboxes) {
        courierCashboxTotal += Number(cashbox.balance);
      }
      for (const cashbox of marketCashboxes) {
        marketCashboxTotal += Number(cashbox.balance);
      }

      // 6️⃣ Response
      return successRes(
        {
          mainCashboxTotal: Number(mainCashbox.balance),
          courierCashboxTotal,
          marketCashboxTotal,
          allCashboxHistories,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        200,
        'All cashbox histories',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async spendMoney(user: JwtPayload, updateCashboxDto: UpdateCashBoxDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      // Naqd yoki karta balansini tekshirish
      if (updateCashboxDto.type === PaymentMethod.CASH) {
        if (mainCashbox.balance_cash < updateCashboxDto.amount) {
          throw new BadRequestException(
            `Naqd kassada yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_cash.toLocaleString()} so'm, So'ralgan: ${updateCashboxDto.amount.toLocaleString()} so'm`,
          );
        }
        mainCashbox.balance_cash -= updateCashboxDto.amount;
      } else {
        if (mainCashbox.balance_card < updateCashboxDto.amount) {
          throw new BadRequestException(
            `Karta/Click balansida yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_card.toLocaleString()} so'm, So'ralgan: ${updateCashboxDto.amount.toLocaleString()} so'm`,
          );
        }
        mainCashbox.balance_card -= updateCashboxDto.amount;
      }

      mainCashbox.balance -= updateCashboxDto.amount;
      await queryRunner.manager.save(mainCashbox);

      const cashboxHistory = queryRunner.manager.create(CashboxHistoryEntity, {
        amount: updateCashboxDto.amount,
        balance_after: mainCashbox.balance,
        cashbox_id: mainCashbox.id,
        comment: updateCashboxDto.comment,
        operation_type: Operation_type.EXPENSE,
        created_by: user.id,
        payment_method: updateCashboxDto.type,
        source_type: Source_type.MANUAL_EXPENSE,
      });
      await queryRunner.manager.save(cashboxHistory);

      // === MOLIYAVIY TAROZI: qo'lda chiqim ===
      const expBalanceAfter = await calculateFinancialBalance(queryRunner.manager);
      await queryRunner.manager.save(
        queryRunner.manager.create(FinancialBalanceHistoryEntity, {
          amount: -updateCashboxDto.amount,
          balance_before: expBalanceAfter + updateCashboxDto.amount,
          balance_after: expBalanceAfter,
          source_type: FinancialSource_type.MANUAL_EXPENSE,
          comment: updateCashboxDto.comment,
          created_by: user.id,
        }),
      );

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'cashbox',
        entity_id: 'main',
        action: 'manual_expense',
        new_value: { amount: updateCashboxDto.amount, type: updateCashboxDto.type, comment: updateCashboxDto.comment },
        description: `Qo'lda chiqim: ${updateCashboxDto.amount} so'm — ${updateCashboxDto.comment || ''}`,
        user,
      });
      return successRes({}, 200, 'Manual expense created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async fillTheCashbox(user: JwtPayload, updateCashboxDto: UpdateCashBoxDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }
      mainCashbox.balance += updateCashboxDto.amount;
      // Naqd yoki karta balansini yangilash
      if (updateCashboxDto.type === PaymentMethod.CASH) {
        mainCashbox.balance_cash += updateCashboxDto.amount;
      } else {
        mainCashbox.balance_card += updateCashboxDto.amount;
      }
      await queryRunner.manager.save(mainCashbox);

      const cashboxHistory = queryRunner.manager.create(CashboxHistoryEntity, {
        amount: updateCashboxDto.amount,
        balance_after: mainCashbox.balance,
        cashbox_id: mainCashbox.id,
        comment: updateCashboxDto.comment,
        operation_type: Operation_type.INCOME,
        created_by: user.id,
        payment_method: updateCashboxDto.type,
        source_type: Source_type.MANUAL_INCOME,
      });
      await queryRunner.manager.save(cashboxHistory);

      // === MOLIYAVIY TAROZI: qo'lda kirim ===
      const fillBalanceAfter = await calculateFinancialBalance(queryRunner.manager);
      await queryRunner.manager.save(
        queryRunner.manager.create(FinancialBalanceHistoryEntity, {
          amount: updateCashboxDto.amount,
          balance_before: fillBalanceAfter - updateCashboxDto.amount,
          balance_after: fillBalanceAfter,
          source_type: FinancialSource_type.MANUAL_INCOME,
          comment: updateCashboxDto.comment,
          created_by: user.id,
        }),
      );

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'cashbox',
        entity_id: 'main',
        action: 'manual_income',
        new_value: { amount: updateCashboxDto.amount, type: updateCashboxDto.type, comment: updateCashboxDto.comment },
        description: `Qo'lda kirim: ${updateCashboxDto.amount} so'm — ${updateCashboxDto.comment || ''}`,
        user,
      });
      return successRes({}, 200, 'Cashbox filled');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async paySalary(user: JwtPayload, salaryDto: SalaryDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { user_id, amount } = salaryDto;
      const staff = await queryRunner.manager.findOne(UserEntity, {
        where: { id: user_id },
      });
      if (!staff) {
        throw new NotFoundException('User not found');
      }
      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      // Naqd yoki karta balansini tekshirish
      if (salaryDto.type === PaymentMethod.CASH) {
        if (mainCashbox.balance_cash < amount) {
          throw new BadRequestException(
            `Naqd kassada yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_cash.toLocaleString()} so'm, So'ralgan: ${amount.toLocaleString()} so'm`,
          );
        }
      } else {
        if (mainCashbox.balance_card < amount) {
          throw new BadRequestException(
            `Karta/Click balansida yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_card.toLocaleString()} so'm, So'ralgan: ${amount.toLocaleString()} so'm`,
          );
        }
      }

      const salary = await queryRunner.manager.findOne(UserSalaryEntity, {
        where: { user_id },
      });
      if (!salary) {
        throw new NotFoundException('Salary for this user not found');
      }
      salary.have_to_pay -= amount;
      await queryRunner.manager.save(salary);

      mainCashbox.balance -= amount;
      // Naqd yoki karta balansini yangilash
      if (salaryDto.type === PaymentMethod.CASH) {
        mainCashbox.balance_cash -= amount;
      } else {
        mainCashbox.balance_card -= amount;
      }
      await queryRunner.manager.save(mainCashbox);

      const cashboxHistory = queryRunner.manager.create(CashboxHistoryEntity, {
        amount,
        balance_after: mainCashbox.balance,
        cashbox_id: mainCashbox.id,
        comment: salaryDto?.comment || `${staff?.name || 'Hodim'} ga maosh to'landi`,
        created_by: user.id,
        payment_method: salaryDto.type,
        operation_type: Operation_type.EXPENSE,
        source_type: Source_type.SALARY,
        source_user_id: user_id,
      });
      await queryRunner.manager.save(cashboxHistory);

      // === MOLIYAVIY TAROZI: maosh to'lovi ===
      const salaryBalanceAfter = await calculateFinancialBalance(queryRunner.manager);
      await queryRunner.manager.save(
        queryRunner.manager.create(FinancialBalanceHistoryEntity, {
          amount: -amount,
          balance_before: salaryBalanceAfter + amount,
          balance_after: salaryBalanceAfter,
          source_type: FinancialSource_type.SALARY,
          related_user_id: user_id,
          comment: salaryDto?.comment || `${staff?.name || 'Hodim'} ga maosh to'landi`,
          created_by: user.id,
        }),
      );

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'cashbox',
        entity_id: user_id,
        action: 'salary',
        new_value: { amount, staff_name: staff?.name },
        description: `Maosh to'landi: ${staff?.name || 'Hodim'} — ${amount} so'm`,
        user,
      });
      return successRes({}, 200, 'Staff salary paid');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== EXCEL EXPORT METHODS ====================

  /**
   * Export main cashbox to Excel with 3 tables
   */
  async exportMainCashboxToExcel(query: {
    fromDate?: string;
    toDate?: string;
    allHistory?: boolean;
  }): Promise<Buffer> {
    try {
      // 1. Fetch cashbox data
      let result: any;
      if (query.allHistory) {
        // Sana belgilanmagan - barcha tarixni olish
        result = await this.getAllMainCashboxHistory();
      } else {
        result = await this.getMainCashbox({ fromDate: query.fromDate, toDate: query.toDate });
      }
      const data = result.data;

      const { cashbox, cashboxHistory, income, outcome } = data;

      // 2. Process transactions - har biri alohida qator
      const individualTransactions = this.getIndividualTransactions(cashboxHistory);
      const expenseTransactions =
        this.filterExpenseTransactions(cashboxHistory);
      const clickTransactions = this.filterClickTransactions(cashboxHistory);

      // 3. Calculate balances split by payment method
      const balances = this.calculateBalances(
        cashbox,
        cashboxHistory,
        income,
        outcome,
      );

      // 4. Generate Excel using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Kunlik Hisobot');

      // 5. Build Table 1 (Main table)
      this.buildMainTable(
        worksheet,
        individualTransactions,
        balances,
        expenseTransactions,
        query,
      );

      // 6. Build Table 2 (Card analysis) - starts at column M
      this.buildCardAnalysisTable(worksheet, clickTransactions, balances);

      // 7. Build Table 3 (Expenses) - starts at column S
      this.buildExpensesTable(worksheet, expenseTransactions);

      // 8. Apply styling (colors, borders, fonts)
      this.applyExcelStyling(worksheet);

      // 9. Return buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer as any;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Group transactions by user/market/courier name
   */
  /**
   * Har bir tranzaksiyani alohida qator sifatida qaytaradi
   * Kirim va Chiqim alohida massivlarda (mustaqil to'ldiriladi)
   */
  private getIndividualTransactions(histories: CashboxHistoryEntity[]) {
    const filtered = histories.filter(
      (tx) =>
        tx.source_type !== Source_type.MANUAL_EXPENSE &&
        tx.source_type !== Source_type.SALARY,
    );

    const income = filtered
      .filter((tx) => tx.operation_type === Operation_type.INCOME)
      .sort((a, b) => Number(a.created_at) - Number(b.created_at))
      .map((tx) => ({
        name: this.getUserNameFromTransaction(tx),
        cash: tx.payment_method === PaymentMethod.CASH ? tx.amount : 0,
        card: tx.payment_method !== PaymentMethod.CASH ? tx.amount : 0,
        comment: tx.comment || '',
      }));

    const expense = filtered
      .filter((tx) => tx.operation_type === Operation_type.EXPENSE)
      .sort((a, b) => Number(a.created_at) - Number(b.created_at))
      .map((tx) => ({
        name: this.getUserNameFromTransaction(tx),
        cash: tx.payment_method === PaymentMethod.CASH ? tx.amount : 0,
        card: tx.payment_method !== PaymentMethod.CASH ? tx.amount : 0,
        comment: tx.comment || '',
      }));

    return { income, expense };
  }

  /**
   * Filter transactions that are expenses (MANUAL_EXPENSE and SALARY only)
   */
  private filterExpenseTransactions(histories: CashboxHistoryEntity[]) {
    return histories.filter(
      (tx) =>
        tx.operation_type === Operation_type.EXPENSE &&
        (tx.source_type === Source_type.MANUAL_EXPENSE ||
          tx.source_type === Source_type.SALARY),
    );
  }

  /**
   * Filter transactions with CLICK payment method
   */
  private filterClickTransactions(histories: CashboxHistoryEntity[]) {
    return histories.filter(
      (tx) =>
        tx.payment_method === PaymentMethod.CLICK ||
        tx.payment_method === PaymentMethod.CLICK_TO_MARKET,
    );
  }

  /**
   * Extract user name from transaction
   */
  private getUserNameFromTransaction(tx: CashboxHistoryEntity): string {
    // Priority: sourceUser (courier/market), then createdByUser
    if (tx.sourceUser?.name) return tx.sourceUser.name;
    if (tx.createdByUser?.name) return tx.createdByUser.name;
    return 'Unknown';
  }

  /**
   * Calculate opening/closing balances split by cash/card
   */
  private calculateBalances(
    cashbox: CashEntity,
    histories: CashboxHistoryEntity[],
    totalIncome: number,
    totalExpense: number,
  ) {
    const currentBalance = cashbox.balance;

    // Calculate income/expense by payment method
    let incomeCash = 0;
    let incomeCard = 0;
    let expenseCash = 0;
    let expenseCard = 0;

    for (const tx of histories) {
      if (tx.operation_type === Operation_type.INCOME) {
        if (tx.payment_method === PaymentMethod.CASH) {
          incomeCash += tx.amount ?? 0;
        } else {
          incomeCard += tx.amount ?? 0;
        }
      } else {
        if (tx.payment_method === PaymentMethod.CASH) {
          expenseCash += tx.amount ?? 0;
        } else {
          expenseCard += tx.amount ?? 0;
        }
      }
    }

    // Opening balance = current - (income - expense) for this period
    const netChange = totalIncome - totalExpense;
    const openingBalance = currentBalance - netChange;

    // Split opening balance proportionally (simple approach)
    // Better would be to query balance before the date range, but this is simpler
    const openingCash = Math.round(openingBalance * 0.6); // Assume 60% cash
    const openingCard = openingBalance - openingCash;

    const closingCash = openingCash + incomeCash - expenseCash;
    const closingCard = openingCard + incomeCard - expenseCard;

    return {
      opening: { cash: openingCash, card: openingCard, total: openingBalance },
      income: { cash: incomeCash, card: incomeCard, total: totalIncome },
      expense: { cash: expenseCash, card: expenseCard, total: totalExpense },
      closing: { cash: closingCash, card: closingCard, total: currentBalance },
    };
  }

  /**
   * Build main income/expense table (Table 1)
   * Kirim (chap tomon) va Chiqim (o'ng tomon) mustaqil to'ldiriladi
   */
  private buildMainTable(
    worksheet: ExcelJS.Worksheet,
    transactions: { income: any[]; expense: any[] },
    balances: any,
    expenses: CashboxHistoryEntity[],
    query: { fromDate?: string; toDate?: string },
  ) {
    const fillCell = (cell: string, bg: string, opts?: { bold?: boolean; size?: number; color?: string; hAlign?: 'center' | 'left' | 'right' }) => {
      const c = worksheet.getCell(cell);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      if (opts?.bold) c.font = { bold: true, size: opts.size || 11, color: opts.color ? { argb: opts.color } : undefined };
      if (opts?.hAlign) c.alignment = { horizontal: opts.hAlign, vertical: 'middle' };
    };

    // ===== ROW 1: Sana =====
    worksheet.mergeCells('A1:K1');
    let dateStr: string;
    if (!query.fromDate && !query.toDate) {
      dateStr = 'Umumiy tarix';
    } else if (query.fromDate === query.toDate) {
      dateStr = `${query.fromDate} noch`;
    } else if (query.fromDate && query.toDate) {
      dateStr = `${query.fromDate} — ${query.toDate}`;
    } else {
      dateStr = `${query.fromDate || new Date().toISOString().split('T')[0]} noch`;
    }
    worksheet.getCell('A1').value = dateStr;
    worksheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFF0000' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    // ===== ROW 2: ASOSIY KASSA sarlavha =====
    worksheet.mergeCells('A2:K2');
    worksheet.getCell('A2').value = 'ASOSIY KASSA';
    fillCell('A2', 'FFFF0000', { bold: true, size: 14, color: 'FF006400', hAlign: 'center' });

    // ===== ROW 3: Kirim / Chiqim =====
    worksheet.mergeCells('B3:F3');
    worksheet.getCell('B3').value = 'Kirim';
    fillCell('B3', 'FF90EE90', { bold: true, hAlign: 'center' });

    worksheet.mergeCells('G3:K3');
    worksheet.getCell('G3').value = 'Chiqim';
    fillCell('G3', 'FFFFC0CB', { bold: true, hAlign: 'center' });

    // ===== ROW 4: Ustun nomlari =====
    const headers = [
      ['A4', 'No'], ['B4', 'QAYERDAN'], ['C4', 'NAQD'], ['D4', 'KARTA'], ['E4', 'DOLLAR'], ['F4', 'Reja'],
      ['G4', 'QAYERGA'], ['H4', 'NAQD'], ['I4', 'KARTA'], ['J4', 'DOLLAR'], ['K4', 'Reja'],
    ];
    headers.forEach(([cell, val]) => {
      worksheet.getCell(cell).value = val;
      fillCell(cell, 'FF90EE90', { bold: true, size: 10, hAlign: 'center' });
    });

    // ===== ROW 5: Qoldiq (ochilish balansi) - faqat kirim tomonida =====
    const dataStartRow = 5;
    worksheet.getCell(`A${dataStartRow}`).value = 1;
    worksheet.getCell(`C${dataStartRow}`).value = balances.opening.cash;
    worksheet.getCell(`D${dataStartRow}`).value = balances.opening.card;
    fillCell(`C${dataStartRow}`, 'FF00BFFF');
    fillCell(`D${dataStartRow}`, 'FF0000FF');
    worksheet.getCell(`D${dataStartRow}`).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // ===== DATA ROWS: Kirim (chap) va Chiqim (o'ng) mustaqil to'ldiriladi =====
    const incomeRows = transactions.income;
    const expenseRows = transactions.expense;
    const maxRows = Math.max(incomeRows.length, expenseRows.length);

    let incomeNo = 2;
    let expenseNo = 1;

    for (let i = 0; i < maxRows; i++) {
      const row = dataStartRow + 1 + i;

      // Kirim (chap tomon)
      if (i < incomeRows.length) {
        const tx = incomeRows[i];
        worksheet.getCell(`A${row}`).value = incomeNo++;
        worksheet.getCell(`B${row}`).value = tx.name;
        if (tx.cash) worksheet.getCell(`C${row}`).value = tx.cash;
        if (tx.card) worksheet.getCell(`D${row}`).value = tx.card;
      }

      // Chiqim (o'ng tomon)
      if (i < expenseRows.length) {
        const tx = expenseRows[i];
        worksheet.getCell(`G${row}`).value = tx.name;
        if (tx.cash) worksheet.getCell(`H${row}`).value = tx.cash;
        if (tx.card) worksheet.getCell(`I${row}`).value = tx.card;
      }
    }

    // ===== XARAJATLAR SUMMARY ROW =====
    const expenseTotalCash = expenses
      .filter((e) => e.payment_method === PaymentMethod.CASH)
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const expenseTotalCard = expenses
      .filter((e) => e.payment_method !== PaymentMethod.CASH)
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);

    // 2 ta bo'sh qator qo'yib
    const xarajatlarRow = dataStartRow + 1 + maxRows + 1;
    worksheet.getCell(`G${xarajatlarRow}`).value = 'Xarajatlar';
    worksheet.getCell(`G${xarajatlarRow}`).font = { bold: true };
    worksheet.getCell(`H${xarajatlarRow}`).value = expenseTotalCash || 0;
    worksheet.getCell(`I${xarajatlarRow}`).value = expenseTotalCard || 0;
    worksheet.getCell(`J${xarajatlarRow}`).value = 0;
    fillCell(`H${xarajatlarRow}`, 'FF00FF00');
    fillCell(`I${xarajatlarRow}`, 'FF00FF00');
    fillCell(`J${xarajatlarRow}`, 'FF00FF00');

    // ===== EMPTY ROW =====
    const emptyRow = xarajatlarRow + 1;

    // ===== TOTAL ROW (jami kirim/chiqim) =====
    const totalRow = emptyRow + 1;
    worksheet.getCell(`C${totalRow}`).value = balances.income.cash;
    worksheet.getCell(`D${totalRow}`).value = balances.income.card;
    worksheet.getCell(`E${totalRow}`).value = 0;
    worksheet.getCell(`H${totalRow}`).value = balances.expense.cash;
    worksheet.getCell(`I${totalRow}`).value = balances.expense.card;
    worksheet.getCell(`J${totalRow}`).value = 0;
    ['C', 'D', 'E'].forEach((col) => fillCell(`${col}${totalRow}`, 'FF00FF00', { bold: true }));
    ['H', 'I', 'J'].forEach((col) => fillCell(`${col}${totalRow}`, 'FF00FF00', { bold: true }));

    // ===== JAMI QOLDIQ =====
    const qoldiqLabelRow = totalRow + 1;
    const qoldiqRow = totalRow + 2;
    worksheet.mergeCells(`C${qoldiqLabelRow}:E${qoldiqLabelRow}`);
    worksheet.getCell(`C${qoldiqLabelRow}`).value = 'Jami qoldiq:';
    worksheet.getCell(`C${qoldiqLabelRow}`).font = { bold: true, size: 12 };
    worksheet.getCell(`C${qoldiqLabelRow}`).alignment = { horizontal: 'right' };

    // Naqd | Karta | Dollar labels
    worksheet.getCell(`H${qoldiqLabelRow}`).value = 'Naqt';
    worksheet.getCell(`I${qoldiqLabelRow}`).value = 'Karta';
    worksheet.getCell(`J${qoldiqLabelRow}`).value = 'Dollar';
    ['H', 'I', 'J'].forEach((col) => {
      worksheet.getCell(`${col}${qoldiqLabelRow}`).font = { bold: true };
      worksheet.getCell(`${col}${qoldiqLabelRow}`).alignment = { horizontal: 'center' };
    });

    worksheet.getCell(`G${qoldiqRow}`).value = 'Jami qoldiq:';
    worksheet.getCell(`G${qoldiqRow}`).font = { bold: true };
    worksheet.getCell(`H${qoldiqRow}`).value = balances.closing.cash;
    worksheet.getCell(`I${qoldiqRow}`).value = balances.closing.card;
    worksheet.getCell(`J${qoldiqRow}`).value = 0;
    fillCell(`H${qoldiqRow}`, 'FF00BFFF', { bold: true });
    fillCell(`I${qoldiqRow}`, 'FFDA70D6', { bold: true });
    fillCell(`J${qoldiqRow}`, 'FF90EE90', { bold: true });
  }

  /**
   * Build card analysis table (Table 2) - Bekzod aka Kartasi
   * Kirim va Chiqim alohida to'ldiriladi
   */
  private buildCardAnalysisTable(
    worksheet: ExcelJS.Worksheet,
    clickTransactions: CashboxHistoryEntity[],
    balances: any,
  ) {
    const COL = { no: 'M', kirimName: 'N', kirimAmount: 'O', chiqimName: 'P', chiqimAmount: 'Q' };

    const fillCell = (cell: string, bg: string, opts?: { bold?: boolean }) => {
      const c = worksheet.getCell(cell);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      if (opts?.bold) c.font = { bold: true };
    };

    // Row 2: Title
    worksheet.mergeCells(`${COL.no}2:${COL.chiqimAmount}2`);
    worksheet.getCell(`${COL.no}2`).value = 'Bekzod aka Kartasi';
    worksheet.getCell(`${COL.no}2`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    worksheet.getCell(`${COL.no}2`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell(`${COL.no}2`).alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Kirim / Chiqim
    worksheet.mergeCells(`${COL.no}3:${COL.kirimAmount}3`);
    worksheet.getCell(`${COL.no}3`).value = 'Kirim';
    worksheet.getCell(`${COL.no}3`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
    worksheet.getCell(`${COL.no}3`).font = { bold: true };
    worksheet.getCell(`${COL.no}3`).alignment = { horizontal: 'center' };

    worksheet.mergeCells(`${COL.chiqimName}3:${COL.chiqimAmount}3`);
    worksheet.getCell(`${COL.chiqimName}3`).value = 'Chiqim';
    worksheet.getCell(`${COL.chiqimName}3`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC0CB' } };
    worksheet.getCell(`${COL.chiqimName}3`).font = { bold: true };
    worksheet.getCell(`${COL.chiqimName}3`).alignment = { horizontal: 'center' };

    // Row 4: Sub-headers
    ['M4', 'N4', 'O4', 'P4', 'Q4'].forEach((cell) => {
      worksheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
      worksheet.getCell(cell).font = { bold: true, size: 10 };
      worksheet.getCell(cell).alignment = { horizontal: 'center' };
    });
    worksheet.getCell('M4').value = 'No';

    // Data
    const clickIncome = clickTransactions
      .filter((tx) => tx.operation_type === Operation_type.INCOME)
      .sort((a, b) => Number(a.created_at) - Number(b.created_at));
    const clickExpense = clickTransactions
      .filter((tx) => tx.operation_type === Operation_type.EXPENSE)
      .sort((a, b) => Number(a.created_at) - Number(b.created_at));

    // Row 5: Qoldiq (ochilish balansi)
    worksheet.getCell('M5').value = 1;
    worksheet.getCell('O5').value = balances.opening.card;
    fillCell('O5', 'FF0000FF');
    worksheet.getCell('O5').font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const maxClickRows = Math.max(clickIncome.length, clickExpense.length);
    let no = 2;
    for (let i = 0; i < maxClickRows; i++) {
      const row = 6 + i;
      if (i < clickIncome.length) {
        const tx = clickIncome[i];
        worksheet.getCell(`${COL.no}${row}`).value = no++;
        worksheet.getCell(`${COL.kirimName}${row}`).value = tx.sourceUser?.name || tx.createdByUser?.name || '';
        worksheet.getCell(`${COL.kirimAmount}${row}`).value = tx.amount;
      }
      if (i < clickExpense.length) {
        const tx = clickExpense[i];
        worksheet.getCell(`${COL.chiqimName}${row}`).value = tx.sourceUser?.name || tx.createdByUser?.name || '';
        worksheet.getCell(`${COL.chiqimAmount}${row}`).value = tx.amount;
      }
    }

    // Totals
    const totalIncome = clickIncome.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);
    const totalExpense = clickExpense.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);
    const totalRow = 6 + maxClickRows;
    worksheet.getCell(`${COL.kirimAmount}${totalRow}`).value = totalIncome;
    worksheet.getCell(`${COL.chiqimAmount}${totalRow}`).value = totalExpense;
    fillCell(`${COL.kirimAmount}${totalRow}`, 'FF00FF00', { bold: true });
    fillCell(`${COL.chiqimAmount}${totalRow}`, 'FF00FF00', { bold: true });

    // Qoldiq
    const qoldiqRow = totalRow + 1;
    worksheet.getCell(`${COL.chiqimName}${qoldiqRow}`).value = 'Qoldiq:';
    worksheet.getCell(`${COL.chiqimName}${qoldiqRow}`).font = { bold: true };
    worksheet.getCell(`${COL.chiqimAmount}${qoldiqRow}`).value = balances.closing.card;
    fillCell(`${COL.chiqimAmount}${qoldiqRow}`, 'FF00BFFF', { bold: true });
  }

  /**
   * Build expenses table (Table 3) - XARAJAT
   */
  private buildExpensesTable(
    worksheet: ExcelJS.Worksheet,
    expenses: CashboxHistoryEntity[],
  ) {
    const COL = { name: 'S', naqd: 'T', karta: 'U', dollar: 'V', reja: 'W' };

    // Row 2: Title
    worksheet.mergeCells(`${COL.name}2:${COL.reja}2`);
    worksheet.getCell(`${COL.name}2`).value = 'XARAJAT';
    worksheet.getCell(`${COL.name}2`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    worksheet.getCell(`${COL.name}2`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell(`${COL.name}2`).alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Column headers
    const hdrs = [
      [COL.name, ''], [COL.naqd, 'NAQD'], [COL.karta, 'KARTA'], [COL.dollar, 'DOLLAR'], [COL.reja, 'REJA'],
    ];
    hdrs.forEach(([col, val]) => {
      const cell = `${col}3`;
      worksheet.getCell(cell).value = val;
      worksheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
      worksheet.getCell(cell).font = { bold: true, size: 10 };
      worksheet.getCell(cell).alignment = { horizontal: 'center' };
    });

    // Expense rows
    let rowNum = 4;
    expenses.forEach((expense) => {
      worksheet.getCell(`${COL.name}${rowNum}`).value =
        expense.comment || expense.sourceUser?.name || expense.createdByUser?.name || 'Xarajat';
      if (expense.payment_method === PaymentMethod.CASH) {
        worksheet.getCell(`${COL.naqd}${rowNum}`).value = expense.amount;
      } else {
        worksheet.getCell(`${COL.karta}${rowNum}`).value = expense.amount;
      }
      rowNum++;
    });

    // Total row
    const totalCash = expenses
      .filter((e) => e.payment_method === PaymentMethod.CASH)
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const totalCard = expenses
      .filter((e) => e.payment_method !== PaymentMethod.CASH)
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);

    const fillCell = (cell: string, bg: string) => {
      worksheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      worksheet.getCell(cell).font = { bold: true };
    };

    worksheet.getCell(`${COL.naqd}${rowNum}`).value = totalCash;
    worksheet.getCell(`${COL.karta}${rowNum}`).value = totalCard;
    worksheet.getCell(`${COL.dollar}${rowNum}`).value = 0;
    fillCell(`${COL.naqd}${rowNum}`, 'FF00BFFF');
    fillCell(`${COL.karta}${rowNum}`, 'FFDA70D6');
    fillCell(`${COL.dollar}${rowNum}`, 'FF90EE90');
  }

  /**
   * Apply Excel styling to the worksheet
   */
  private applyExcelStyling(worksheet: ExcelJS.Worksheet) {
    // ASOSIY KASSA columns (A-K)
    worksheet.getColumn('A').width = 5;
    worksheet.getColumn('B').width = 16;
    worksheet.getColumn('C').width = 12;
    worksheet.getColumn('D').width = 12;
    worksheet.getColumn('E').width = 10;
    worksheet.getColumn('F').width = 8;
    worksheet.getColumn('G').width = 16;
    worksheet.getColumn('H').width = 12;
    worksheet.getColumn('I').width = 12;
    worksheet.getColumn('J').width = 10;
    worksheet.getColumn('K').width = 8;

    // Gap column
    worksheet.getColumn('L').width = 3;

    // Bekzod aka Kartasi (M-Q)
    worksheet.getColumn('M').width = 5;
    worksheet.getColumn('N').width = 14;
    worksheet.getColumn('O').width = 12;
    worksheet.getColumn('P').width = 14;
    worksheet.getColumn('Q').width = 12;

    // Gap column
    worksheet.getColumn('R').width = 3;

    // XARAJAT (S-W)
    worksheet.getColumn('S').width = 20;
    worksheet.getColumn('T').width = 12;
    worksheet.getColumn('U').width = 12;
    worksheet.getColumn('V').width = 10;
    worksheet.getColumn('W').width = 8;

    // Borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });
  }

  // ==================== SHIFT (SMENA) METHODS ====================

  /**
   * Get current open shift
   */
  async getCurrentShift() {
    try {
      const openShift = await this.shiftRepo.findOne({
        where: { status: ShiftStatus.OPEN },
        relations: ['openedByUser'],
        order: { opened_at: 'DESC' },
      });

      return successRes({ shift: openShift }, 200, 'Current shift');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Open a new shift
   */
  async openShift(user: JwtPayload) {
    try {
      // Check if there's already an open shift
      const existingOpenShift = await this.shiftRepo.findOne({
        where: { status: ShiftStatus.OPEN },
      });

      if (existingOpenShift) {
        throw new BadRequestException(
          'Ochiq smena mavjud. Avval uni yoping!',
        );
      }

      // Get main cashbox balance
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });

      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      // Calculate current cash/card split from today's transactions
      const { start, end } = getUzbekistanDayRange();
      const todayHistories = await this.cashboxHistoryRepo.find({
        where: {
          cashbox_id: mainCashbox.id,
          created_at: Between(start, end),
        },
      });

      const balances = this.calculateCurrentBalances(
        mainCashbox.balance,
        todayHistories,
      );

      // Create new shift
      const shift = this.shiftRepo.create({
        opened_by: user.id,
        opened_at: Date.now(),
        status: ShiftStatus.OPEN,
        opening_balance_cash: balances.cash,
        opening_balance_card: balances.card,
      });

      await this.shiftRepo.save(shift);

      this.activityLog.log({
        entity_type: 'shift',
        entity_id: shift.id,
        action: 'opened',
        new_value: { opening_balance_cash: balances.cash, opening_balance_card: balances.card },
        description: `Smena ochildi — naqd: ${balances.cash}, karta: ${balances.card}`,
        user,
      });

      return successRes({ shift }, 201, 'Smena ochildi');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Close current shift and return Excel report data
   */
  async closeShift(user: JwtPayload, comment?: string) {
    try {
      // Find open shift
      const openShift = await this.shiftRepo.findOne({
        where: { status: ShiftStatus.OPEN },
        relations: ['openedByUser'],
      });

      if (!openShift) {
        throw new BadRequestException('Ochiq smena topilmadi!');
      }

      // Get main cashbox
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });

      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      // Get all transactions during this shift
      const shiftHistories = await this.cashboxHistoryRepo.find({
        where: {
          cashbox_id: mainCashbox.id,
          created_at: Between(openShift.opened_at, Date.now()),
        },
        relations: ['createdByUser'],
      });

      // Calculate totals
      let totalIncomeCash = 0;
      let totalIncomeCard = 0;
      let totalExpenseCash = 0;
      let totalExpenseCard = 0;

      for (const tx of shiftHistories) {
        const amount = Number(tx.amount);
        if (tx.operation_type === Operation_type.INCOME) {
          if (tx.payment_method === PaymentMethod.CASH) {
            totalIncomeCash += amount;
          } else {
            totalIncomeCard += amount;
          }
        } else {
          if (tx.payment_method === PaymentMethod.CASH) {
            totalExpenseCash += amount;
          } else {
            totalExpenseCard += amount;
          }
        }
      }

      // Calculate closing balances
      const closingBalanceCash =
        openShift.opening_balance_cash + totalIncomeCash - totalExpenseCash;
      const closingBalanceCard =
        openShift.opening_balance_card + totalIncomeCard - totalExpenseCard;

      // Update shift
      openShift.closed_by = user.id;
      openShift.closed_at = Date.now();
      openShift.status = ShiftStatus.CLOSED;
      openShift.closing_balance_cash = closingBalanceCash;
      openShift.closing_balance_card = closingBalanceCard;
      openShift.total_income_cash = totalIncomeCash;
      openShift.total_income_card = totalIncomeCard;
      openShift.total_expense_cash = totalExpenseCash;
      openShift.total_expense_card = totalExpenseCard;
      openShift.comment = comment || '';

      await this.shiftRepo.save(openShift);

      // Generate shift report data
      const reportData = {
        shift: openShift,
        summary: {
          opening: {
            cash: openShift.opening_balance_cash,
            card: openShift.opening_balance_card,
            total:
              openShift.opening_balance_cash + openShift.opening_balance_card,
          },
          income: {
            cash: totalIncomeCash,
            card: totalIncomeCard,
            total: totalIncomeCash + totalIncomeCard,
          },
          expense: {
            cash: totalExpenseCash,
            card: totalExpenseCard,
            total: totalExpenseCash + totalExpenseCard,
          },
          closing: {
            cash: closingBalanceCash,
            card: closingBalanceCard,
            total: closingBalanceCash + closingBalanceCard,
          },
        },
        transactions: shiftHistories,
      };

      this.activityLog.log({
        entity_type: 'shift',
        entity_id: openShift.id,
        action: 'closed',
        new_value: {
          closing_balance_cash: openShift.closing_balance_cash,
          closing_balance_card: openShift.closing_balance_card,
          total_income_cash: openShift.total_income_cash,
          total_expense_cash: openShift.total_expense_cash,
        },
        description: `Smena yopildi — jami kirim: ${openShift.total_income_cash + openShift.total_income_card}, jami chiqim: ${openShift.total_expense_cash + openShift.total_expense_card}`,
        user,
      });

      return successRes(reportData, 200, 'Smena yopildi');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Export shift report to Excel
   */
  async exportShiftToExcel(shiftId?: string): Promise<Buffer> {
    try {
      let shift: ShiftEntity | null;

      if (shiftId) {
        shift = await this.shiftRepo.findOne({
          where: { id: shiftId },
          relations: ['openedByUser', 'closedByUser'],
        });
      } else {
        // Get the last closed shift
        shift = await this.shiftRepo.findOne({
          where: { status: ShiftStatus.CLOSED },
          relations: ['openedByUser', 'closedByUser'],
          order: { closed_at: 'DESC' },
        });
      }

      if (!shift) {
        throw new NotFoundException('Smena topilmadi');
      }

      // Get main cashbox
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });

      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      // Get transactions for this shift period
      const shiftHistories = await this.cashboxHistoryRepo.find({
        where: {
          cashbox_id: mainCashbox.id,
          created_at: Between(shift.opened_at, shift.closed_at || Date.now()),
        },
        relations: ['createdByUser', 'sourceUser'],
      });

      // Generate Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Smena Hisoboti');

      // Build shift report
      this.buildShiftReportExcel(worksheet, shift, shiftHistories);

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer as any;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Build shift report Excel — asosiy kassa shabloni bilan bir xil
   */
  private buildShiftReportExcel(
    worksheet: ExcelJS.Worksheet,
    shift: ShiftEntity,
    histories: CashboxHistoryEntity[],
  ) {
    // Shift balanslarini hisoblash
    let totalIncome = 0;
    let totalExpense = 0;
    for (const h of histories) {
      if (h.operation_type === Operation_type.INCOME) totalIncome += h.amount ?? 0;
      else totalExpense += h.amount ?? 0;
    }

    const balances = {
      opening: {
        cash: shift.opening_balance_cash || 0,
        card: shift.opening_balance_card || 0,
        total: (shift.opening_balance_cash || 0) + (shift.opening_balance_card || 0),
      },
      income: this.calculateMethodTotals(histories, Operation_type.INCOME),
      expense: this.calculateMethodTotals(histories, Operation_type.EXPENSE),
      closing: {
        cash: shift.closing_balance_cash || (shift.opening_balance_cash || 0),
        card: shift.closing_balance_card || (shift.opening_balance_card || 0),
        total: (shift.closing_balance_cash || 0) + (shift.closing_balance_card || 0),
      },
    };

    const transactions = this.getIndividualTransactions(histories);
    const expenseTransactions = this.filterExpenseTransactions(histories);
    const clickTransactions = this.filterClickTransactions(histories);

    // Sana formati (bigint timestamp)
    const openDate = new Date(Number(shift.opened_at)).toLocaleDateString('uz-UZ');
    const closeDate = shift.closed_at
      ? new Date(Number(shift.closed_at)).toLocaleDateString('uz-UZ')
      : 'davom etmoqda';
    const query = { fromDate: openDate, toDate: closeDate };

    // Xuddi asosiy kassa shabloni bilan bir xil 3 ta jadval
    this.buildMainTable(worksheet, transactions, balances, expenseTransactions, query);
    this.buildCardAnalysisTable(worksheet, clickTransactions, balances);
    this.buildExpensesTable(worksheet, expenseTransactions);
    this.applyExcelStyling(worksheet);
  }

  /**
   * Calculate income/expense totals by payment method
   */
  private calculateMethodTotals(
    histories: CashboxHistoryEntity[],
    operationType: Operation_type,
  ) {
    let cash = 0;
    let card = 0;
    for (const tx of histories) {
      if (tx.operation_type !== operationType) continue;
      if (
        tx.source_type === Source_type.MANUAL_EXPENSE ||
        tx.source_type === Source_type.SALARY
      ) continue;
      if (tx.payment_method === PaymentMethod.CASH) cash += tx.amount ?? 0;
      else card += tx.amount ?? 0;
    }
    return { cash, card, total: cash + card };
  }

  /**
   * Calculate current cash/card balances
   */
  private calculateCurrentBalances(
    totalBalance: number,
    histories: CashboxHistoryEntity[],
  ) {
    let cashBalance = 0;
    let cardBalance = 0;

    for (const tx of histories) {
      if (tx.operation_type === Operation_type.INCOME) {
        if (tx.payment_method === PaymentMethod.CASH) {
          cashBalance += tx.amount ?? 0;
        } else {
          cardBalance += tx.amount ?? 0;
        }
      } else {
        if (tx.payment_method === PaymentMethod.CASH) {
          cashBalance -= tx.amount ?? 0;
        } else {
          cardBalance -= tx.amount ?? 0;
        }
      }
    }

    // If we don't have history, split proportionally
    if (histories.length === 0) {
      cashBalance = Math.round(totalBalance * 0.6);
      cardBalance = totalBalance - cashBalance;
    }

    return { cash: cashBalance, card: cardBalance };
  }

  /**
   * Get shift history (list of all shifts)
   */
  async getShiftHistory(query: { page?: number; limit?: number; fetchAll?: boolean }) {
    try {
      const page = query.page || 1;
      const limit = getSafeLimit(query.limit, query.fetchAll);
      const skip = (page - 1) * limit;

      const [shifts, total] = await this.shiftRepo.findAndCount({
        relations: ['openedByUser', 'closedByUser'],
        order: { created_at: 'DESC' },
        skip,
        take: limit,
      });

      return successRes(
        {
          data: shifts,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        200,
        'Shift history',
      );
    } catch (error) {
      return catchError(error);
    }
  }
}
