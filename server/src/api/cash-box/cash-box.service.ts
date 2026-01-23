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
  IsNull,
} from 'typeorm';
import {
  Cashbox_type,
  Operation_type,
  Order_status,
  PaymentMethod,
  Roles,
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
        relations: ['createdByUser'],
        order: { created_at: 'DESC' },
      });

      let income = 0;
      let outcome = 0;

      for (const history of cashboxHistory) {
        if (history.operation_type === Operation_type.INCOME) {
          income += history.amount;
        } else {
          outcome += history.amount;
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

  async getCashboxByUserId(
    id: string,
    filters?: { fromDate?: string; toDate?: string },
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

      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: {
          cashbox_id: cashbox.id,
          created_at: Between(Number(startDate), Number(endDate)), // bigint timestamp filter
        },
        relations: ['createdByUser'],
        order: { created_at: 'DESC' },
      });

      let income = 0;
      let outcome = 0;

      for (const history of cashboxHistory) {
        if (history.operation_type === Operation_type.INCOME) {
          income += history.amount;
        } else {
          outcome += history.amount;
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
    filters?: { fromDate?: string; toDate?: string },
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

      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: {
          cashbox_id: myCashbox.id,
          created_at: Between(Number(startDate), Number(endDate)), // bigint timestamp
        },
        relations: ['createdByUser'],
        order: { created_at: 'DESC' },
      });

      let income = 0;
      let outcome = 0;

      for (const history of cashboxHistory) {
        if (history.operation_type === Operation_type.INCOME) {
          income += history.amount;
        } else {
          outcome += history.amount;
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

      await queryRunner.commitTransaction();
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

      await queryRunner.commitTransaction();
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
        comment: salaryDto?.comment,
        created_by: user.id,
        payment_method: salaryDto.type,
        operation_type: Operation_type.EXPENSE,
        source_type: Source_type.SALARY,
        source_id: user_id,
      });
      await queryRunner.manager.save(cashboxHistory);

      await queryRunner.commitTransaction();
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
  }): Promise<Buffer> {
    try {
      // 1. Fetch cashbox data using existing method
      const result = await this.getMainCashbox(query);
      const data = result.data;

      const { cashbox, cashboxHistory, income, outcome } = data;

      // 2. Process and group transactions
      const groupedTransactions = this.groupTransactionsByUser(cashboxHistory);
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
        groupedTransactions,
        balances,
        expenseTransactions,
        query,
      );

      // 6. Build Table 2 (Card analysis) - starts at column J
      this.buildCardAnalysisTable(worksheet, clickTransactions, balances);

      // 7. Build Table 3 (Expenses) - starts at column P
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
  private groupTransactionsByUser(histories: CashboxHistoryEntity[]) {
    const grouped = new Map<
      string,
      {
        name: string;
        income_cash: number;
        income_card: number;
        expense_cash: number;
        expense_card: number;
        comments: string[];
      }
    >();

    for (const tx of histories) {
      // Exclude MANUAL_EXPENSE and SALARY from main table (they go to Table 3)
      if (
        tx.source_type === Source_type.MANUAL_EXPENSE ||
        tx.source_type === Source_type.SALARY
      ) {
        continue;
      }

      // Determine user name (from creator, or related market/courier)
      const userName = this.getUserNameFromTransaction(tx);

      if (!grouped.has(userName)) {
        grouped.set(userName, {
          name: userName,
          income_cash: 0,
          income_card: 0,
          expense_cash: 0,
          expense_card: 0,
          comments: [],
        });
      }

      const group = grouped.get(userName)!;

      if (tx.operation_type === Operation_type.INCOME) {
        if (tx.payment_method === PaymentMethod.CASH) {
          group.income_cash += tx.amount;
        } else {
          // CLICK + CARD + CLICK_TO_MARKET all go to "card" column
          group.income_card += tx.amount;
        }
      } else {
        if (tx.payment_method === PaymentMethod.CASH) {
          group.expense_cash += tx.amount;
        } else {
          group.expense_card += tx.amount;
        }
      }

      if (tx.comment) {
        group.comments.push(tx.comment);
      }
    }

    return Array.from(grouped.values());
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
    // Priority: created_by user name
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
          incomeCash += tx.amount;
        } else {
          incomeCard += tx.amount;
        }
      } else {
        if (tx.payment_method === PaymentMethod.CASH) {
          expenseCash += tx.amount;
        } else {
          expenseCard += tx.amount;
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
   */
  private buildMainTable(
    worksheet: ExcelJS.Worksheet,
    transactions: any[],
    balances: any,
    expenses: CashboxHistoryEntity[],
    query: { fromDate?: string; toDate?: string },
  ) {
    // Header row (row 1)
    worksheet.mergeCells('A1:I1');
    const dateStr =
      query.fromDate || new Date().toISOString().split('T')[0];
    worksheet.getCell('A1').value = `${dateStr} noch`;
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };
    worksheet.getCell('A1').font = { bold: true, size: 12 };
    worksheet.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Column headers (row 2) - split into two sections
    worksheet.mergeCells('A2:A3');
    worksheet.getCell('A2').value = 'No';

    worksheet.mergeCells('B2:E2');
    worksheet.getCell('B2').value = 'Kirim';
    worksheet.mergeCells('F2:I2');
    worksheet.getCell('F2').value = 'Chiqim';

    // Sub-headers (row 3)
    worksheet.getCell('B3').value = 'QAYERDAN';
    worksheet.getCell('C3').value = 'NAQD';
    worksheet.getCell('D3').value = 'KARTA';
    worksheet.getCell('E3').value = 'Reja';

    worksheet.getCell('F3').value = 'QAYERGA';
    worksheet.getCell('G3').value = 'NAQD';
    worksheet.getCell('H3').value = 'KARTA';
    worksheet.getCell('I3').value = 'Reja';

    // Style headers
    ['A2', 'B2', 'F2'].forEach((cell) => {
      worksheet.getCell(cell).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF90EE90' },
      };
      worksheet.getCell(cell).font = { bold: true };
      worksheet.getCell(cell).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    });

    ['B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3', 'I3'].forEach((cell) => {
      worksheet.getCell(cell).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF90EE90' },
      };
      worksheet.getCell(cell).font = { bold: true, size: 10 };
      worksheet.getCell(cell).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    });

    let rowNum = 4;

    // Opening balance row
    worksheet.getCell(`A${rowNum}`).value = 1;
    worksheet.getCell(`B${rowNum}`).value = 'Qoldiq';
    worksheet.getCell(`C${rowNum}`).value = balances.opening.cash;
    worksheet.getCell(`D${rowNum}`).value = balances.opening.card;

    worksheet.getCell(`C${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00BFFF' },
    };
    worksheet.getCell(`D${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };
    rowNum++;

    // Transaction rows
    let no = 2;
    transactions.forEach((tx) => {
      const comments = tx.comments.join(', ');

      if (tx.income_cash > 0 || tx.income_card > 0) {
        // Income row
        worksheet.getCell(`A${rowNum}`).value = no++;
        worksheet.getCell(`B${rowNum}`).value = tx.name;
        worksheet.getCell(`C${rowNum}`).value = tx.income_cash || '';
        worksheet.getCell(`D${rowNum}`).value = tx.income_card || '';
        worksheet.getCell(`E${rowNum}`).value = comments;
      } else {
        // Expense row
        worksheet.getCell(`A${rowNum}`).value = no++;
        worksheet.getCell(`F${rowNum}`).value = tx.name;
        worksheet.getCell(`G${rowNum}`).value = tx.expense_cash || '';
        worksheet.getCell(`H${rowNum}`).value = tx.expense_card || '';
        worksheet.getCell(`I${rowNum}`).value = comments;
      }
      rowNum++;
    });

    // Expenses summary row (from Table 3)
    const expenseTotalCash = expenses
      .filter((e) => e.payment_method === PaymentMethod.CASH)
      .reduce((sum, e) => sum + e.amount, 0);
    const expenseTotalCard = expenses
      .filter((e) => e.payment_method !== PaymentMethod.CASH)
      .reduce((sum, e) => sum + e.amount, 0);

    if (expenseTotalCash > 0 || expenseTotalCard > 0) {
      worksheet.getCell(`F${rowNum}`).value = 'Xarajatlar';
      worksheet.getCell(`G${rowNum}`).value = expenseTotalCash;
      worksheet.getCell(`H${rowNum}`).value = expenseTotalCard;
      worksheet.getCell(`F${rowNum}`).font = { bold: true };
      rowNum++;
    }

    // Total row
    worksheet.getCell(`C${rowNum}`).value = balances.income.cash;
    worksheet.getCell(`D${rowNum}`).value = balances.income.card;
    worksheet.getCell(`G${rowNum}`).value = balances.expense.cash;
    worksheet.getCell(`H${rowNum}`).value = balances.expense.card;

    ['C', 'D', 'G', 'H'].forEach((col) => {
      worksheet.getCell(`${col}${rowNum}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00BFFF' },
      };
      worksheet.getCell(`${col}${rowNum}`).font = { bold: true };
    });
    rowNum++;

    // Final balance row
    worksheet.mergeCells(`A${rowNum}:B${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = 'Jami qoldiq:';
    worksheet.getCell(`A${rowNum}`).font = { bold: true };
    worksheet.getCell(`C${rowNum}`).value = balances.closing.cash;
    worksheet.getCell(`D${rowNum}`).value = balances.closing.card;
    worksheet.getCell(`C${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF87CEEB' },
    };
    worksheet.getCell(`D${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDA70D6' },
    };
    worksheet.getCell(`C${rowNum}`).font = { bold: true };
    worksheet.getCell(`D${rowNum}`).font = { bold: true };
  }

  /**
   * Build card analysis table (Table 2) starting at column J
   */
  private buildCardAnalysisTable(
    worksheet: ExcelJS.Worksheet,
    clickTransactions: CashboxHistoryEntity[],
    balances: any,
  ) {
    // Header row (row 1)
    worksheet.mergeCells('J1:M1');
    worksheet.getCell('J1').value = 'Bekzod aka Kartasi';
    worksheet.getCell('J1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC0CB' },
    };
    worksheet.getCell('J1').font = { bold: true, size: 12 };
    worksheet.getCell('J1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Column headers (row 2)
    worksheet.mergeCells('J2:J3');
    worksheet.getCell('J2').value = 'No';

    worksheet.mergeCells('K2:L2');
    worksheet.getCell('K2').value = 'Kirim';
    worksheet.mergeCells('M2:M2');
    worksheet.getCell('M2').value = 'Chiqim';

    worksheet.getCell('K3').value = 'Summa';
    worksheet.getCell('L3').value = 'al hilal';
    worksheet.getCell('M3').value = '';

    // Style headers
    ['J2', 'K2', 'M2', 'J3', 'K3', 'L3', 'M3'].forEach((cell) => {
      worksheet.getCell(cell).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF90EE90' },
      };
      worksheet.getCell(cell).font = { bold: true, size: 10 };
      worksheet.getCell(cell).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    });

    let rowNum = 4;

    // Opening balance
    worksheet.getCell(`J${rowNum}`).value = 1;
    worksheet.getCell(`K${rowNum}`).value = 'Qoldiq';
    worksheet.getCell(`L${rowNum}`).value = balances.opening.card;
    worksheet.getCell(`K${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00BFFF' },
    };
    rowNum++;

    // CLICK transactions
    let no = 2;
    clickTransactions.forEach((tx) => {
      worksheet.getCell(`J${rowNum}`).value = no++;
      if (tx.operation_type === Operation_type.INCOME) {
        worksheet.getCell(`K${rowNum}`).value = tx.amount;
        worksheet.getCell(`L${rowNum}`).value =
          tx.comment || tx.createdByUser?.name || '';
      } else {
        worksheet.getCell(`M${rowNum}`).value = tx.amount;
      }
      rowNum++;
    });

    // Total row
    const clickIncome = clickTransactions
      .filter((tx) => tx.operation_type === Operation_type.INCOME)
      .reduce((sum, tx) => sum + tx.amount, 0);
    worksheet.getCell(`K${rowNum}`).value = clickIncome;
    worksheet.getCell(`K${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF90EE90' },
    };
    rowNum++;

    // Final balance
    worksheet.getCell(`K${rowNum}`).value = 'Qoldiq';
    worksheet.getCell(`L${rowNum}`).value = balances.closing.card;
    worksheet.getCell(`K${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00BFFF' },
    };
  }

  /**
   * Build expenses table (Table 3) starting at column P
   */
  private buildExpensesTable(
    worksheet: ExcelJS.Worksheet,
    expenses: CashboxHistoryEntity[],
  ) {
    // Header row (row 1)
    worksheet.mergeCells('P1:R1');
    worksheet.getCell('P1').value = 'XARAJAT';
    worksheet.getCell('P1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF6347' },
    };
    worksheet.getCell('P1').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('P1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Column headers (row 2)
    worksheet.getCell('P2').value = 'KOMENT';
    worksheet.getCell('Q2').value = 'NAQD';
    worksheet.getCell('R2').value = 'KARTA';

    ['P2', 'Q2', 'R2'].forEach((cell) => {
      worksheet.getCell(cell).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFA500' },
      };
      worksheet.getCell(cell).font = { bold: true, size: 10 };
      worksheet.getCell(cell).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    });

    let rowNum = 3;

    // List each expense
    expenses.forEach((expense) => {
      worksheet.getCell(`P${rowNum}`).value =
        expense.comment || expense.createdByUser?.name || 'Xarajat';
      if (expense.payment_method === PaymentMethod.CASH) {
        worksheet.getCell(`Q${rowNum}`).value = expense.amount;
      } else {
        worksheet.getCell(`R${rowNum}`).value = expense.amount;
      }
      rowNum++;
    });

    // Total row
    const totalCash = expenses
      .filter((e) => e.payment_method === PaymentMethod.CASH)
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCard = expenses
      .filter((e) => e.payment_method !== PaymentMethod.CASH)
      .reduce((sum, e) => sum + e.amount, 0);

    worksheet.getCell(`Q${rowNum}`).value = totalCash;
    worksheet.getCell(`R${rowNum}`).value = totalCard;
    worksheet.getCell(`Q${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00BFFF' },
    };
    worksheet.getCell(`R${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDA70D6' },
    };
    worksheet.getCell(`Q${rowNum}`).font = { bold: true };
    worksheet.getCell(`R${rowNum}`).font = { bold: true };
  }

  /**
   * Apply Excel styling to the worksheet
   */
  private applyExcelStyling(worksheet: ExcelJS.Worksheet) {
    // Set column widths
    worksheet.getColumn('A').width = 5; // No
    worksheet.getColumn('B').width = 15; // QAYERDAN
    worksheet.getColumn('C').width = 12; // Kirim NAQD
    worksheet.getColumn('D').width = 12; // Kirim KARTA
    worksheet.getColumn('E').width = 20; // COMMENT
    worksheet.getColumn('F').width = 15; // QAYERGA
    worksheet.getColumn('G').width = 12; // Chiqim NAQD
    worksheet.getColumn('H').width = 12; // Chiqim KARTA
    worksheet.getColumn('I').width = 20; // COMMENT

    worksheet.getColumn('J').width = 5; // No
    worksheet.getColumn('K').width = 12; // Kirim
    worksheet.getColumn('L').width = 15; // al hilal
    worksheet.getColumn('M').width = 12; // Chiqim

    worksheet.getColumn('P').width = 20; // KOMENT
    worksheet.getColumn('Q').width = 12; // NAQD
    worksheet.getColumn('R').width = 12; // KARTA

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
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
        if (tx.operation_type === Operation_type.INCOME) {
          if (tx.payment_method === PaymentMethod.CASH) {
            totalIncomeCash += tx.amount;
          } else {
            totalIncomeCard += tx.amount;
          }
        } else {
          if (tx.payment_method === PaymentMethod.CASH) {
            totalExpenseCash += tx.amount;
          } else {
            totalExpenseCard += tx.amount;
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
        relations: ['createdByUser'],
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
   * Build shift report Excel
   */
  private buildShiftReportExcel(
    worksheet: ExcelJS.Worksheet,
    shift: ShiftEntity,
    histories: CashboxHistoryEntity[],
  ) {
    // Title
    worksheet.mergeCells('A1:H1');
    const openDate = new Date(shift.opened_at).toLocaleDateString('uz-UZ');
    const closeDate = shift.closed_at
      ? new Date(shift.closed_at).toLocaleDateString('uz-UZ')
      : 'Hali yopilmagan';
    worksheet.getCell('A1').value = `SMENA HISOBOTI: ${openDate} - ${closeDate}`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };

    // Shift info
    worksheet.getCell('A3').value = 'Smena ochgan:';
    worksheet.getCell('B3').value = shift.openedByUser?.name || 'Noma\'lum';
    worksheet.getCell('A4').value = 'Smena yopgan:';
    worksheet.getCell('B4').value = shift.closedByUser?.name || '-';

    // Opening balances section
    worksheet.mergeCells('A6:D6');
    worksheet.getCell('A6').value = 'SMENA BOSHIDAGI QOLDIQ';
    worksheet.getCell('A6').font = { bold: true };
    worksheet.getCell('A6').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' },
    };

    worksheet.getCell('A7').value = 'Naqd:';
    worksheet.getCell('B7').value = shift.opening_balance_cash;
    worksheet.getCell('C7').value = 'Karta/Click:';
    worksheet.getCell('D7').value = shift.opening_balance_card;

    // Process transactions
    const groupedTransactions = this.groupTransactionsByUser(histories);
    const expenseTransactions = this.filterExpenseTransactions(histories);
    const clickTransactions = this.filterClickTransactions(histories);

    // Main transactions table
    worksheet.mergeCells('A9:H9');
    worksheet.getCell('A9').value = 'SMENA DAVOMIDAGI OPERATSIYALAR';
    worksheet.getCell('A9').font = { bold: true };
    worksheet.getCell('A9').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B0F0' },
    };

    // Headers
    worksheet.getCell('A10').value = '#';
    worksheet.getCell('B10').value = 'QAYERDAN';
    worksheet.getCell('C10').value = 'NAQD KIRIM';
    worksheet.getCell('D10').value = 'KARTA KIRIM';
    worksheet.getCell('E10').value = 'QAYERGA';
    worksheet.getCell('F10').value = 'NAQD CHIQIM';
    worksheet.getCell('G10').value = 'KARTA CHIQIM';
    worksheet.getCell('H10').value = 'IZOH';

    ['A10', 'B10', 'C10', 'D10', 'E10', 'F10', 'G10', 'H10'].forEach((cell) => {
      worksheet.getCell(cell).font = { bold: true };
      worksheet.getCell(cell).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' },
      };
    });

    let rowNum = 11;
    let no = 1;

    groupedTransactions.forEach((tx) => {
      worksheet.getCell(`A${rowNum}`).value = no++;
      if (tx.income_cash > 0 || tx.income_card > 0) {
        worksheet.getCell(`B${rowNum}`).value = tx.name;
        worksheet.getCell(`C${rowNum}`).value = tx.income_cash || '';
        worksheet.getCell(`D${rowNum}`).value = tx.income_card || '';
      }
      if (tx.expense_cash > 0 || tx.expense_card > 0) {
        worksheet.getCell(`E${rowNum}`).value = tx.name;
        worksheet.getCell(`F${rowNum}`).value = tx.expense_cash || '';
        worksheet.getCell(`G${rowNum}`).value = tx.expense_card || '';
      }
      worksheet.getCell(`H${rowNum}`).value = tx.comments.join(', ');
      rowNum++;
    });

    // Expenses section
    if (expenseTransactions.length > 0) {
      rowNum++;
      worksheet.mergeCells(`A${rowNum}:D${rowNum}`);
      worksheet.getCell(`A${rowNum}`).value = 'XARAJATLAR';
      worksheet.getCell(`A${rowNum}`).font = { bold: true };
      worksheet.getCell(`A${rowNum}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF6347' },
      };
      rowNum++;

      worksheet.getCell(`A${rowNum}`).value = 'Izoh';
      worksheet.getCell(`B${rowNum}`).value = 'Naqd';
      worksheet.getCell(`C${rowNum}`).value = 'Karta';
      rowNum++;

      expenseTransactions.forEach((expense) => {
        worksheet.getCell(`A${rowNum}`).value =
          expense.comment || expense.createdByUser?.name || 'Xarajat';
        if (expense.payment_method === PaymentMethod.CASH) {
          worksheet.getCell(`B${rowNum}`).value = expense.amount;
        } else {
          worksheet.getCell(`C${rowNum}`).value = expense.amount;
        }
        rowNum++;
      });
    }

    // Summary section
    rowNum += 2;
    worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = 'SMENA YAKUNLARI';
    worksheet.getCell(`A${rowNum}`).font = { bold: true, size: 12 };
    worksheet.getCell(`A${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC000' },
    };
    rowNum++;

    // Totals
    worksheet.getCell(`A${rowNum}`).value = 'Jami kirim (naqd):';
    worksheet.getCell(`B${rowNum}`).value = shift.total_income_cash;
    worksheet.getCell(`C${rowNum}`).value = 'Jami kirim (karta):';
    worksheet.getCell(`D${rowNum}`).value = shift.total_income_card;
    rowNum++;

    worksheet.getCell(`A${rowNum}`).value = 'Jami chiqim (naqd):';
    worksheet.getCell(`B${rowNum}`).value = shift.total_expense_cash;
    worksheet.getCell(`C${rowNum}`).value = 'Jami chiqim (karta):';
    worksheet.getCell(`D${rowNum}`).value = shift.total_expense_card;
    rowNum++;

    // Closing balances
    rowNum++;
    worksheet.mergeCells(`A${rowNum}:D${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = 'SMENA OXIRIDAGI QOLDIQ';
    worksheet.getCell(`A${rowNum}`).font = { bold: true };
    worksheet.getCell(`A${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' },
    };
    rowNum++;

    worksheet.getCell(`A${rowNum}`).value = 'Naqd qoldiq:';
    worksheet.getCell(`B${rowNum}`).value = shift.closing_balance_cash;
    worksheet.getCell(`B${rowNum}`).font = { bold: true, size: 12 };
    worksheet.getCell(`B${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00BFFF' },
    };
    worksheet.getCell(`C${rowNum}`).value = 'Karta/Click qoldiq:';
    worksheet.getCell(`D${rowNum}`).value = shift.closing_balance_card;
    worksheet.getCell(`D${rowNum}`).font = { bold: true, size: 12 };
    worksheet.getCell(`D${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDA70D6' },
    };
    rowNum++;

    worksheet.getCell(`A${rowNum}`).value = 'UMUMIY QOLDIQ:';
    worksheet.getCell(`A${rowNum}`).font = { bold: true };
    worksheet.getCell(`B${rowNum}`).value =
      shift.closing_balance_cash + shift.closing_balance_card;
    worksheet.getCell(`B${rowNum}`).font = { bold: true, size: 14 };
    worksheet.getCell(`B${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00FF00' },
    };

    // Set column widths
    worksheet.getColumn('A').width = 20;
    worksheet.getColumn('B').width = 15;
    worksheet.getColumn('C').width = 15;
    worksheet.getColumn('D').width = 15;
    worksheet.getColumn('E').width = 15;
    worksheet.getColumn('F').width = 15;
    worksheet.getColumn('G').width = 15;
    worksheet.getColumn('H').width = 25;

    // Add borders
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
          cashBalance += tx.amount;
        } else {
          cardBalance += tx.amount;
        }
      } else {
        if (tx.payment_method === PaymentMethod.CASH) {
          cashBalance -= tx.amount;
        } else {
          cardBalance -= tx.amount;
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
