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
import { Between, DataSource, DeepPartial, In } from 'typeorm';
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

  async getMainCashbox(filters?: { fromDate?: string; toDate?: string }) {
    try {
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });

      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      let fromDate: number;
      let toDate: number;

      if (filters?.fromDate && filters?.toDate) {
        fromDate = new Date(filters.fromDate).setHours(0, 0, 0, 0);
        toDate = new Date(filters.toDate).setHours(23, 59, 59, 999);
      } else {
        const today = new Date();
        fromDate = new Date(today.setHours(0, 0, 0, 0)).getTime();
        toDate = new Date(today.setHours(23, 59, 59, 999)).getTime();
      }

      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: {
          cashbox_id: mainCashbox.id,
          created_at: Between(fromDate, toDate), // bigint timestamp
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
      const user = await this.userRepo.findOne({ where: { id } });
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
      let fromDate: number;
      let toDate: number;

      if (filters?.fromDate && filters?.toDate) {
        fromDate = new Date(filters.fromDate).setHours(0, 0, 0, 0);
        toDate = new Date(filters.toDate).setHours(23, 59, 59, 999);
      } else {
        const today = new Date();
        fromDate = new Date(today.setHours(0, 0, 0, 0)).getTime();
        toDate = new Date(today.setHours(23, 59, 59, 999)).getTime();
      }

      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: {
          cashbox_id: cashbox.id,
          created_at: Between(fromDate, toDate), // bigint timestamp filter
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
      let fromDate: number;
      let toDate: number;

      if (filters?.fromDate && filters?.toDate) {
        fromDate = new Date(filters.fromDate).setHours(0, 0, 0, 0);
        toDate = new Date(filters.toDate).setHours(23, 59, 59, 999);
      } else {
        const today = new Date();
        fromDate = new Date(today.setHours(0, 0, 0, 0)).getTime();
        toDate = new Date(today.setHours(23, 59, 59, 999)).getTime();
      }

      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: {
          cashbox_id: myCashbox.id,
          created_at: Between(fromDate, toDate), // bigint timestamp
        },
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
        const market_cashbox = await transaction.manager.findOne(CashEntity, {
          where: { user_id: market_id, cashbox_type: Cashbox_type.FOR_MARKET },
        });

        if (!market_cashbox) {
          throw new NotFoundException('Market cashbox topilmadi');
        }

        const allSoldOrders = await transaction.manager.find(OrderEntity, {
          where: {
            status: In([Order_status.SOLD, Order_status.PARTLY_PAID]),
            user_id: market_id,
          },
          order: { updated_at: 'ASC' },
        });

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

      if (Number(mainCashbox.balance) < Number(amount)) {
        throw new BadRequestException(`Asosiy kassada mablag' yetarli emas`);
      }

      const allSoldOrders = await queryRunner.manager.find(OrderEntity, {
        where: {
          status: In([Order_status.SOLD, Order_status.PARTLY_PAID]),
          user_id: market_id,
        },
        order: { updated_at: 'ASC' },
      });

      // ✅ Main cashboxdan pul ayirish
      mainCashbox.balance -= amount;
      await queryRunner.manager.save(mainCashbox);

      await queryRunner.manager.save(
        queryRunner.manager.create(CashboxHistoryEntity, {
          operation_type: Operation_type.EXPENSE,
          cashbox_id: mainCashbox.id,
          source_type: Source_type.MARKET_PAYMENT,
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
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    try {
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

      // vaqt oralig‘i
      let fromDate: number;
      let toDate: number;
      if (filters?.fromDate && filters?.toDate) {
        fromDate = new Date(filters.fromDate).setHours(0, 0, 0, 0);
        toDate = new Date(filters.toDate).setHours(23, 59, 59, 999);
      } else {
        const today = new Date();
        fromDate = new Date(today.setHours(0, 0, 0, 0)).getTime();
        toDate = new Date(today.setHours(23, 59, 59, 999)).getTime();
      }

      // pagination parametrlari
      const page = filters?.page && filters.page > 0 ? filters.page : 1;
      const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
      const skip = (page - 1) * limit;

      // tarixlarni pagination bilan olish
      const [allCashboxHistories, total] =
        await this.cashboxHistoryRepo.findAndCount({
          where: { created_at: Between(fromDate, toDate) },
          relations: ['createdByUser'],
          order: { created_at: 'DESC' },
          skip,
          take: limit,
        });

      let courierCashboxTotal = 0;
      let marketCashboxTotal = 0;
      for (const cashbox of courierCashboxes) {
        courierCashboxTotal += Number(cashbox.balance);
      }
      for (const cashbox of marketCashboxes) {
        marketCashboxTotal += Number(cashbox.balance);
      }

      return successRes({
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
        filter: {
          fromDate,
          toDate,
        },
      });
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
      return successRes({}, 200, 'Cashbox filled');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }
}
