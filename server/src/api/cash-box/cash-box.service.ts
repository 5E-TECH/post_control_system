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

  async getMainCashbox() {
    try {
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });

      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: { cashbox_id: mainCashbox.id },
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

  async getCashboxByUserId(id: string) {
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
      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: { cashbox_id: cashbox.id },
        relations: ['createdByUser'],
      });

      let income: number = 0;
      let outcome: number = 0;

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

  async myCashbox(user: JwtPayload) {
    try {
      const myCashbox = await this.cashboxRepo.findOne({
        where: { user_id: user.id },
      });
      if (!myCashbox) {
        throw new NotFoundException('Cashbox not found');
      }
      const cashboxHistory = await this.cashboxHistoryRepo.find({
        where: { cashbox_id: myCashbox.id },
      });

      let income: number = 0;
      let outcome: number = 0;

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
        'Cashbox details',
      );
      return successRes(myCashbox, 200, 'My cashbox');
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
        const market_cashbox = await this.cashboxRepo.findOne({
          where: { user_id: market_id, cashbox_type: Cashbox_type.FOR_MARKET },
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
          user_id: market_id,
          cashbox_type: Cashbox_type.FOR_MARKET,
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
          user_id: market_id,
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
      });
      let courierBalanses: object[] = [];
      let couriersTotalBalanse: number = 0;
      for (const cashbox of allCourierCashboxes) {
        courierBalanses.push({
          userId: cashbox.user_id,
          balance: cashbox.balance,
        });
        couriersTotalBalanse += Number(cashbox.balance);
      }

      const allMarketCashboxes = await this.cashboxRepo.find({
        where: { cashbox_type: Cashbox_type.FOR_MARKET },
      });
      let marketCashboxes: object[] = [];
      let marketsTotalBalans: number = 0;
      for (const cashbox of allMarketCashboxes) {
        marketCashboxes.push({
          userId: cashbox.user_id,
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

  async allCashboxesTotal() {
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

      const allCashboxHistories = await this.cashboxHistoryRepo.find({
        order: { created_at: 'DESC' },
      });

      let courierCashboxTotal: number = 0;
      let marketCashboxTotal: number = 0;
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
      mainCashbox?.balance - updateCashboxDto.amount;
      await queryRunner.manager.save(mainCashbox);

      const cashboxHistory = queryRunner.manager.create(CashboxHistoryEntity, {
        amount: updateCashboxDto.amount,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }
}
