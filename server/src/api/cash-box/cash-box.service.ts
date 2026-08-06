import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { CreateCashBoxDto } from './dto/create-cash-box.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { InvestorDistributionEntity } from 'src/core/entity/investor-distribution.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { catchError } from 'src/infrastructure/lib/response';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import {
  Between,
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  IsNull,
  Repository,
} from 'typeorm';
import {
  CardMovementType,
  Cashbox_type,
  FinancialSource_type,
  Operation_type,
  Order_status,
  PaymentMethod,
  Roles,
  Source_type,
} from 'src/common/enums';
import { CashboxCardEntity } from 'src/core/entity/cashbox-card.entity';
import { CashboxCardMovementEntity } from 'src/core/entity/cashbox-card-movement.entity';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { calculateFinancialBalance } from 'src/common/utils/financial-balance.util';
import { successRes } from 'src/infrastructure/lib/response';
import { CreatePaymentsFromCourierDto } from './dto/payments-from-courier.dto';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { CashboxHistoryRepository } from 'src/core/repository/cashbox-history.repository';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { PaymentsToMarketDto } from './dto/payment-to-market.dto';
import {
  CreateCardDto,
  RenameCardDto,
  TransferCardDto,
  ConvertCardDto,
} from './dto/card.dto';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import { UpdateCashBoxDto } from './dto/update-cash-box.dto';
import { SalaryDto } from './dto/salary.dto';
import { PayInvestorDto } from './dto/pay-investor.dto';
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

    @InjectRepository(CashboxCardEntity)
    private readonly cashboxCardRepo: Repository<CashboxCardEntity>,

    @InjectRepository(CashboxCardMovementEntity)
    private readonly cardMovementRepo: Repository<CashboxCardMovementEntity>,

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

  /**
   * Smena ochiqligini tekshirish — asosiy kassa operatsiyalari uchun
   */
  private async requireOpenShift(): Promise<void> {
    const openShift = await this.shiftRepo.findOne({
      where: { status: ShiftStatus.OPEN },
    });
    if (!openShift) {
      throw new BadRequestException(
        'Smena ochilmagan! Bu operatsiyani bajarish uchun avval smenani oching.',
      );
    }
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

      // Asosiy kassada himoyalangan "Asosiy karta" mavjudligini ta'minlash.
      // Migratsiya mavjud kassalar uchun buni qiladi; bu yer esa YANGI (bo'sh)
      // DB holatini qoplaydi (kassa runtime'da yuqorida yaratilganda).
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (mainCashbox) {
        const defaultCard = await this.cashboxCardRepo.findOne({
          where: { cashbox_id: mainCashbox.id, is_default: true },
        });
        if (!defaultCard) {
          await this.cashboxCardRepo.save(
            this.cashboxCardRepo.create({
              name: 'Asosiy karta',
              balance: mainCashbox.balance_card ?? 0,
              cashbox_id: mainCashbox.id,
              is_default: true,
              is_active: true,
              sort_order: 0,
            }),
          );
        }
      }
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== VIRTUAL KARTA HELPER'LARI ====================

  /**
   * MAIN kassaning himoyalangan default ("Asosiy karta") kartasini qaytaradi.
   * "O'tib ketuvchi" (click_to_market) va default-fallback holatlarida ishlatiladi.
   */
  private async getDefaultCard(
    manager: EntityManager,
    cashboxId: string,
  ): Promise<CashboxCardEntity> {
    const card = await manager.findOne(CashboxCardEntity, {
      where: { cashbox_id: cashboxId, is_default: true },
    });
    if (!card) {
      throw new NotFoundException(
        "Asosiy karta topilmadi. Migratsiya bajarilganini tekshiring.",
      );
    }
    return card;
  }

  /**
   * Kartali operatsiya uchun qaysi kartaga yozilishini aniqlaydi:
   *   - CASH                → null (karta yo'q)
   *   - CLICK_TO_MARKET     → default karta (o'tib ketuvchi to'lov)
   *   - CLICK               → tanlangan karta (tekshiriladi) yoki default (fallback)
   */
  private async resolveCardForOp(
    manager: EntityManager,
    mainCashbox: CashEntity,
    paymentMethod: PaymentMethod | null | undefined,
    providedCardId?: string | null,
  ): Promise<string | null> {
    if (!paymentMethod || paymentMethod === PaymentMethod.CASH) return null;

    if (paymentMethod === PaymentMethod.CLICK_TO_MARKET) {
      const def = await this.getDefaultCard(manager, mainCashbox.id);
      return def.id;
    }

    // CLICK
    if (providedCardId) {
      const card = await manager.findOne(CashboxCardEntity, {
        where: { id: providedCardId },
      });
      if (!card || card.cashbox_id !== mainCashbox.id) {
        throw new BadRequestException(
          "Karta topilmadi yoki ushbu kassaga tegishli emas",
        );
      }
      if (!card.is_active && !card.is_default) {
        throw new BadRequestException(
          `"${card.name}" kartasi arxivlangan — operatsiya uchun faol karta tanlang`,
        );
      }
      return card.id;
    }

    const def = await this.getDefaultCard(manager, mainCashbox.id);
    return def.id;
  }

  /**
   * Virtual karta balansini VA MAIN kassaning `balance_card` ini BIRGA o'zgartiradi.
   * INVARIANT (SUM(card.balance) === balance_card) shu YAGONA nuqta orqali saqlanadi.
   *
   * Kartani `pessimistic_write` lock bilan oladi (poyga/race'dan himoya). Chiqimda
   * (delta < 0) shu kartaning yetarli mablag'ini tekshiradi. `mainCashbox.balance_card`
   * xotirada yangilanadi — uni saqlash chaqiruvchi metod zimmasida (balance/balance_cash
   * bilan birga bitta save'da).
   */
  private async applyCardDelta(
    manager: EntityManager,
    mainCashbox: CashEntity,
    cardId: string,
    delta: number,
  ): Promise<CashboxCardEntity> {
    const card = await manager.findOne(CashboxCardEntity, {
      where: { id: cardId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!card) throw new NotFoundException('Virtual karta topilmadi');
    if (card.cashbox_id !== mainCashbox.id) {
      throw new BadRequestException('Karta ushbu kassaga tegishli emas');
    }
    if (delta < 0 && card.balance + delta < 0) {
      throw new BadRequestException(
        `"${card.name}" kartasida yetarli mablag' yo'q! Mavjud: ${card.balance.toLocaleString()} so'm, So'ralgan: ${Math.abs(delta).toLocaleString()} so'm`,
      );
    }
    card.balance += delta;
    await manager.save(card);
    mainCashbox.balance_card += delta;
    return card;
  }

  // ==================== VIRTUAL KARTA CRUD ====================

  /** MAIN kassaning barcha kartalari (balanslari bilan). */
  async listCards(includeInactive = false) {
    try {
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');

      const where: Record<string, unknown> = { cashbox_id: mainCashbox.id };
      if (!includeInactive) where.is_active = true;

      const cards = await this.cashboxCardRepo.find({
        where,
        order: { is_default: 'DESC', sort_order: 'ASC', created_at: 'ASC' },
      });

      const totalCard = cards.reduce((s, c) => s + (c.balance ?? 0), 0);

      return successRes(
        {
          cards,
          balance_card: mainCashbox.balance_card,
          balance_cash: mainCashbox.balance_cash,
          balance: mainCashbox.balance,
          // Invariant nazorati uchun: kartalar yig'indisi balance_card ga teng bo'lishi kerak
          totalCard,
          inSync: totalCard === mainCashbox.balance_card,
        },
        200,
        'Cards',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /** Yangi virtual karta yaratish (balans 0 bilan). */
  async createCard(user: JwtPayload, dto: CreateCardDto) {
    try {
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');

      const name = dto.name?.trim();
      if (!name) throw new BadRequestException('Karta nomi majburiy');

      const exists = await this.cashboxCardRepo.findOne({
        where: { cashbox_id: mainCashbox.id, name },
      });
      if (exists) {
        throw new BadRequestException('Bunday nomli karta allaqachon mavjud');
      }

      const card = await this.cashboxCardRepo.save(
        this.cashboxCardRepo.create({
          name,
          balance: 0,
          cashbox_id: mainCashbox.id,
          is_default: false,
          is_active: true,
          sort_order: dto.sort_order ?? 0,
        }),
      );

      this.activityLog.log({
        entity_type: 'cashbox_card',
        entity_id: card.id,
        action: 'card_created',
        new_value: { name },
        description: `Yangi karta yaratildi: ${name}`,
        user,
      });
      return successRes({ card }, 201, 'Karta yaratildi');
    } catch (error) {
      return catchError(error);
    }
  }

  /** Karta nomini o'zgartirish (default kartani O'ZGARTIRIB BO'LMAYDI). */
  async renameCard(user: JwtPayload, id: string, dto: RenameCardDto) {
    try {
      const card = await this.cashboxCardRepo.findOne({ where: { id } });
      if (!card) throw new NotFoundException('Karta topilmadi');
      if (card.is_default) {
        throw new BadRequestException(
          "Asosiy kartaning nomini o'zgartirib bo'lmaydi",
        );
      }
      const name = dto.name?.trim();
      if (!name) throw new BadRequestException('Karta nomi majburiy');

      const dup = await this.cashboxCardRepo.findOne({
        where: { cashbox_id: card.cashbox_id, name },
      });
      if (dup && dup.id !== id) {
        throw new BadRequestException('Bunday nomli karta allaqachon mavjud');
      }

      const oldName = card.name;
      card.name = name;
      await this.cashboxCardRepo.save(card);

      this.activityLog.log({
        entity_type: 'cashbox_card',
        entity_id: card.id,
        action: 'card_renamed',
        old_value: { name: oldName },
        new_value: { name },
        description: `Karta nomi o'zgartirildi: "${oldName}" → "${name}"`,
        user,
      });
      return successRes({ card }, 200, "Karta nomi o'zgartirildi");
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Kartani arxivlash/qayta faollashtirish.
   * Default kartani arxivlab bo'lmaydi; arxivlash uchun balans 0 bo'lishi shart.
   */
  async setCardActive(user: JwtPayload, id: string, isActive: boolean) {
    try {
      const card = await this.cashboxCardRepo.findOne({ where: { id } });
      if (!card) throw new NotFoundException('Karta topilmadi');

      if (!isActive) {
        if (card.is_default) {
          throw new BadRequestException("Asosiy kartani arxivlab bo'lmaydi");
        }
        if (card.balance !== 0) {
          throw new BadRequestException(
            `Kartani arxivlashdan oldin balansini (${card.balance.toLocaleString()} so'm) boshqa kartaga yoki naqdga o'tkazing`,
          );
        }
      }

      card.is_active = isActive;
      await this.cashboxCardRepo.save(card);

      this.activityLog.log({
        entity_type: 'cashbox_card',
        entity_id: card.id,
        action: isActive ? 'card_activated' : 'card_deactivated',
        new_value: { is_active: isActive },
        description: `"${card.name}" kartasi ${isActive ? 'faollashtirildi' : 'arxivlandi'}`,
        user,
      });
      return successRes(
        { card },
        200,
        isActive ? 'Karta faollashtirildi' : 'Karta arxivlandi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  // ==================== ICHKI KO'CHIRMA / KONVERTATSIYA ====================
  // ❗ MUHIM: ko'chirma/konvertatsiya kassaning umumiy `balance` ini
  // O'ZGARTIRMAYDI — shu sababli ular `FinancialBalanceHistoryEntity` yozMAYDI
  // (yozsa moliyaviy taroziда fantom delta paydo bo'lardi) va `cashbox_history`
  // ga ham yozilmaydi (kirim/chiqim yig'indilarini buzmaslik uchun).

  /** Bir kartadan boshqasiga pul o'tkazish (balance_card o'zgarmaydi). */
  async transferBetweenCards(user: JwtPayload, dto: TransferCardDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.requireOpenShift();
      const { from_card_id, to_card_id, amount, comment } = dto;
      if (!amount || amount <= 0) {
        throw new BadRequestException("Miqdor 0 dan katta bo'lishi kerak");
      }
      if (!comment || !comment.trim()) {
        throw new BadRequestException("O'tkazma uchun izoh (sabab) majburiy");
      }
      if (from_card_id === to_card_id) {
        throw new BadRequestException(
          "Manba va maqsad karta bir xil bo'lmasligi kerak",
        );
      }

      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
        lock: { mode: 'pessimistic_write' },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');

      // applyCardDelta: from -= amount (yetarlilikni tekshiradi), to += amount.
      // balance_card sof o'zgarishi = 0 (invariant saqlanadi).
      const fromCard = await this.applyCardDelta(
        queryRunner.manager,
        mainCashbox,
        from_card_id,
        -amount,
      );
      const toCard = await this.applyCardDelta(
        queryRunner.manager,
        mainCashbox,
        to_card_id,
        amount,
      );
      await queryRunner.manager.save(mainCashbox);

      const movement = queryRunner.manager.create(CashboxCardMovementEntity, {
        type: CardMovementType.CARD_TO_CARD,
        cashbox_id: mainCashbox.id,
        from_card_id,
        to_card_id,
        amount,
        balance_after_from: fromCard.balance,
        balance_after_to: toCard.balance,
        comment: comment ?? null,
        created_by: user.id,
      });
      await queryRunner.manager.save(movement);

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'cashbox_card',
        entity_id: from_card_id,
        action: 'card_transfer',
        new_value: {
          amount,
          from: fromCard.name,
          to: toCard.name,
        },
        description: `Kartalararo o'tkazma: "${fromCard.name}" → "${toCard.name}" — ${amount.toLocaleString()} so'm`,
        user,
      });
      return successRes({ movement }, 201, "O'tkazma bajarildi");
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Karta↔Naqd konvertatsiya (balance o'zgarmaydi, faqat cash/card ajratimi). */
  async convertCard(user: JwtPayload, dto: ConvertCardDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.requireOpenShift();
      const { type, card_id, amount, comment } = dto;
      if (!amount || amount <= 0) {
        throw new BadRequestException("Miqdor 0 dan katta bo'lishi kerak");
      }
      if (!comment || !comment.trim()) {
        throw new BadRequestException(
          'Konvertatsiya uchun izoh (sabab) majburiy',
        );
      }
      if (
        type !== CardMovementType.CARD_TO_CASH &&
        type !== CardMovementType.CASH_TO_CARD
      ) {
        throw new BadRequestException(
          "Konvertatsiya turi faqat karta→naqd yoki naqd→karta bo'lishi mumkin",
        );
      }

      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
        lock: { mode: 'pessimistic_write' },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');

      let card: CashboxCardEntity;
      if (type === CardMovementType.CARD_TO_CASH) {
        // Kartadan naqdga: card -= amount (+ balance_card -= amount), balance_cash += amount
        card = await this.applyCardDelta(
          queryRunner.manager,
          mainCashbox,
          card_id,
          -amount,
        );
        mainCashbox.balance_cash += amount;
      } else {
        // Naqddan kartaga: balance_cash -= amount (tekshirib), card += amount
        if (mainCashbox.balance_cash < amount) {
          throw new BadRequestException(
            `Naqd kassada yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_cash.toLocaleString()} so'm, So'ralgan: ${amount.toLocaleString()} so'm`,
          );
        }
        mainCashbox.balance_cash -= amount;
        card = await this.applyCardDelta(
          queryRunner.manager,
          mainCashbox,
          card_id,
          amount,
        );
      }
      // balance (umumiy) o'zgarmaydi — faqat naqd/karta ajratimi siljiydi
      await queryRunner.manager.save(mainCashbox);

      const isToCash = type === CardMovementType.CARD_TO_CASH;
      const movement = queryRunner.manager.create(CashboxCardMovementEntity, {
        type,
        cashbox_id: mainCashbox.id,
        from_card_id: isToCash ? card_id : null,
        to_card_id: isToCash ? null : card_id,
        amount,
        balance_after_from: isToCash ? card.balance : null,
        balance_after_to: isToCash ? null : card.balance,
        comment: comment ?? null,
        created_by: user.id,
      });
      await queryRunner.manager.save(movement);

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'cashbox_card',
        entity_id: card_id,
        action: 'card_convert',
        new_value: { type, amount, card: card.name },
        description: isToCash
          ? `"${card.name}" kartasidan naqdga: ${amount.toLocaleString()} so'm`
          : `Naqddan "${card.name}" kartasiga: ${amount.toLocaleString()} so'm`,
        user,
      });
      return successRes({ movement }, 201, 'Konvertatsiya bajarildi');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Kartalar bo'yicha ichki ko'chirma/konvertatsiya tarixi. */
  async listCardMovements(filters?: {
    cardId?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');

      const page = Math.max(1, Number(filters?.page) || 1);
      const limit = getSafeLimit(Number(filters?.limit) || 20);

      const qb = this.cardMovementRepo
        .createQueryBuilder('m')
        .leftJoinAndSelect('m.fromCard', 'fromCard')
        .leftJoinAndSelect('m.toCard', 'toCard')
        .leftJoinAndSelect('m.createdByUser', 'createdByUser')
        .where('m.cashbox_id = :cashboxId', { cashboxId: mainCashbox.id });

      if (filters?.cardId) {
        qb.andWhere(
          '(m.from_card_id = :cardId OR m.to_card_id = :cardId)',
          { cardId: filters.cardId },
        );
      }

      const [movements, total] = await qb
        .orderBy('m.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return successRes(
        {
          movements,
          pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        },
        200,
        'Card movements',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Bitta virtual kartaning TO'LIQ hisobvarag'i (bank-vipiska kabi):
   * real kirim/chiqim (cashbox_history.card_id) + ichki o'tkazma/konvertatsiya
   * (cashbox_card_movement) birlashtiriladi, running balans hisoblanadi va
   * kategoriyalar bo'yicha yig'indi beriladi. Har bir satr KIM qilganini
   * ko'rsatadi (javobgarlik). Bu YIG'INDILAR kassa kirim/chiqimiga ta'sir
   * qilmaydi — faqat shu karta ichidagi ko'rinish.
   */
  async getCardLedger(
    cardId: string,
    filters?: {
      fromDate?: string;
      toDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    try {
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');

      const card = await this.cashboxCardRepo.findOne({
        where: { id: cardId },
      });
      if (!card || card.cashbox_id !== mainCashbox.id) {
        throw new NotFoundException('Karta topilmadi');
      }

      // 1) Real kirim/chiqim (shu kartaga tegishli)
      const histories = await this.cashboxHistoryRepo.find({
        where: { card_id: cardId },
        relations: ['createdByUser', 'sourceUser'],
      });
      // 2) Ichki o'tkazma/konvertatsiya (shu karta ishtirok etgan)
      const movements = await this.cardMovementRepo.find({
        where: [{ from_card_id: cardId }, { to_card_id: cardId }],
        relations: ['fromCard', 'toCard', 'createdByUser'],
      });

      type LedgerRow = {
        id: string;
        kind:
          | 'income'
          | 'expense'
          | 'transfer_in'
          | 'transfer_out'
          | 'convert_in'
          | 'convert_out';
        amount: number;
        delta: number;
        created_at: number;
        created_by_name: string | null;
        counterparty: string | null;
        comment: string | null;
        source_type?: string;
        payment_method?: string | null;
        balance_after?: number;
      };

      const rows: LedgerRow[] = [];
      for (const h of histories) {
        const isIncome = h.operation_type === Operation_type.INCOME;
        const amt = h.amount ?? 0;
        rows.push({
          id: h.id,
          kind: isIncome ? 'income' : 'expense',
          amount: amt,
          delta: isIncome ? amt : -amt,
          created_at: h.created_at,
          created_by_name: h.createdByUser?.name ?? null,
          counterparty: h.sourceUser?.name ?? null,
          comment: h.comment ?? null,
          source_type: h.source_type,
          payment_method: h.payment_method,
        });
      }
      for (const m of movements) {
        const base = {
          id: m.id,
          amount: m.amount,
          created_at: m.created_at,
          created_by_name: m.createdByUser?.name ?? null,
          comment: m.comment ?? null,
        };
        if (m.type === CardMovementType.CARD_TO_CARD) {
          if (m.to_card_id === cardId) {
            rows.push({
              ...base,
              kind: 'transfer_in',
              delta: m.amount,
              counterparty: m.fromCard?.name ?? null,
            });
          } else {
            rows.push({
              ...base,
              kind: 'transfer_out',
              delta: -m.amount,
              counterparty: m.toCard?.name ?? null,
            });
          }
        } else if (m.type === CardMovementType.CASH_TO_CARD) {
          rows.push({
            ...base,
            kind: 'convert_in',
            delta: m.amount,
            counterparty: 'Naqd',
          });
        } else if (m.type === CardMovementType.CARD_TO_CASH) {
          rows.push({
            ...base,
            kind: 'convert_out',
            delta: -m.amount,
            counterparty: 'Naqd',
          });
        }
      }

      // To'liq tarix bo'yicha (sanadan qat'i nazar) running balansni hisoblash —
      // yakuni card.balance ga teng bo'lishi kerak.
      rows.sort((a, b) => a.created_at - b.created_at);
      let running = 0;
      for (const r of rows) {
        running += r.delta;
        r.balance_after = running;
      }

      // Ko'rsatish uchun sana filtri (ixtiyoriy)
      let display = rows;
      if (filters?.fromDate && filters?.toDate) {
        const startN = Number(toUzbekistanTimestamp(filters.fromDate, false));
        const endN = Number(toUzbekistanTimestamp(filters.toDate, true));
        display = rows.filter(
          (r) => r.created_at >= startN && r.created_at <= endN,
        );
      }

      const sumBy = (pred: (r: LedgerRow) => boolean) =>
        display.filter(pred).reduce((s, r) => s + r.amount, 0);
      const summary = {
        real_income: sumBy((r) => r.kind === 'income'),
        real_expense: sumBy((r) => r.kind === 'expense'),
        transfer_in: sumBy((r) => r.kind === 'transfer_in'),
        transfer_out: sumBy((r) => r.kind === 'transfer_out'),
        convert_in: sumBy((r) => r.kind === 'convert_in'),
        convert_out: sumBy((r) => r.kind === 'convert_out'),
        current_balance: card.balance,
      };

      // Eng yangisi birinchi + pagination
      const sortedDesc = [...display].sort(
        (a, b) => b.created_at - a.created_at,
      );
      const page = Math.max(1, Number(filters?.page) || 1);
      const limit = getSafeLimit(Number(filters?.limit) || 50);
      const total = sortedDesc.length;
      const paged = sortedDesc.slice((page - 1) * limit, page * limit);

      return successRes(
        {
          card,
          rows: paged,
          summary,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        200,
        'Card ledger',
      );
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
        relations: ['createdByUser', 'sourceUser', 'card', 'order'],
        order: { created_at: 'DESC' },
      });

      // Virtual kartalar (faol) — CashboxCard breakdown va tanlovi uchun
      const cards = await this.cashboxCardRepo.find({
        where: { cashbox_id: mainCashbox.id, is_active: true },
        order: { is_default: 'DESC', sort_order: 'ASC', created_at: 'ASC' },
      });

      // Ichki ko'chirma/konvertatsiya — umumiy tarixда NEYTRAL satr sifatida
      // ko'rsatish uchun (kirim/chiqimga SANALMAYDI; alohida maydon, shu sabab
      // Excel/yig'indi yo'llari buzilmaydi).
      const movements = await this.cardMovementRepo.find({
        where: {
          cashbox_id: mainCashbox.id,
          created_at: Between(Number(startDate), Number(endDate)),
        },
        relations: ['fromCard', 'toCard', 'createdByUser'],
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
        {
          cashbox: mainCashbox,
          cashboxHistory,
          cards,
          movements,
          income,
          outcome,
        },
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
      relations: ['createdByUser', 'sourceUser', 'order'],
      order: { created_at: 'DESC' },
    });

    // Virtual kartalar — Excel'dagi "Kartalar bo'yicha joriy qoldiq" bo'limi uchun
    const cards = await this.cashboxCardRepo.find({
      where: { cashbox_id: mainCashbox.id, is_active: true },
      order: { is_default: 'DESC', sort_order: 'ASC', created_at: 'ASC' },
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
      { cashbox: mainCashbox, cashboxHistory, cards, income, outcome },
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
      await this.requireOpenShift();
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
          // Click_to_market bo'lsa — pul to'g'ridan-to'g'ri qaysi marketga
          // ketganini kuryer tarixida ko'rsatish uchun source_user_id = market_id.
          source_user_id:
            payment_method === PaymentMethod.CLICK_TO_MARKET ? market_id : null,
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
      // Naqd yoki karta balansini yangilash. Karta bo'lsa — tanlangan virtual
      // kartaga (CLICK) yoki default kartaga (CLICK_TO_MARKET o'tib ketuvchi).
      let incomeCardId: string | null = null;
      if (payment_method === PaymentMethod.CASH) {
        mainCashbox.balance_cash += amount;
      } else {
        incomeCardId = await this.resolveCardForOp(
          transaction.manager,
          mainCashbox,
          payment_method,
          createPaymentsFromCourierDto.card_id,
        );
        await this.applyCardDelta(
          transaction.manager,
          mainCashbox,
          incomeCardId as string,
          amount,
        );
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
          balance_after_cash: mainCashbox.balance_cash,
          balance_after_card: mainCashbox.balance_card,
          comment,
          created_by: user.id,
          payment_date,
          payment_method,
          card_id: incomeCardId,
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
        // CLICK_TO_MARKET — pul o'sha (default) kartadan chiqib ketadi.
        await this.applyCardDelta(
          transaction.manager,
          mainCashbox,
          incomeCardId as string,
          -amount,
        );
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
            balance_after_cash: mainCashbox.balance_cash,
            balance_after_card: mainCashbox.balance_card,
            comment,
            created_by: user.id,
            payment_date,
            payment_method,
            card_id: incomeCardId,
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
            // Pul qaysi kuryerdan (click orqali) tushganini market
            // tarixida ko'rsatish uchun source_user_id = courier_id.
            source_user_id: courier_id,
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
      const courier = await this.userRepo.findOne({
        where: { id: createPaymentsFromCourierDto.courier_id },
        select: ['id', 'name'],
      });
      this.activityLog.log({
        entity_type: 'cashbox',
        entity_id: createPaymentsFromCourierDto.courier_id,
        action: 'courier_payment',
        new_value: {
          amount: createPaymentsFromCourierDto.amount,
          payment_method: createPaymentsFromCourierDto.payment_method,
          counterparty_name: courier?.name,
        },
        description: `${courier?.name || 'Kuryer'}dan ${
          createPaymentsFromCourierDto.amount
        } so'm qabul qilindi (${this.getPaymentMethodLabelUz(
          createPaymentsFromCourierDto.payment_method,
        )})`,
        user,
      });
      return successRes({}, 201, "To'lov qabul qilindi !!! ");
    } catch (error) {
      await transaction.rollbackTransaction();
      return catchError(error);
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
      await this.requireOpenShift();
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

      // Kartali to'lov uchun virtual kartani aniqlash (CASH bo'lsa null)
      const marketCardId = await this.resolveCardForOp(
        queryRunner.manager,
        mainCashbox,
        payment_method,
        paymentToMarketDto.card_id,
      );

      // Naqd balansini tekshirish (karta yetarliligi quyida applyCardDelta
      // ichida pessimistic lock bilan, tanlangan karta bo'yicha tekshiriladi)
      if (payment_method === PaymentMethod.CASH) {
        if (mainCashbox.balance_cash < amount) {
          throw new BadRequestException(
            `Naqd kassada yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_cash.toLocaleString()} so'm, So'ralgan: ${amount.toLocaleString()} so'm`,
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
      // Naqd yoki tanlangan virtual kartadan ayirish
      if (payment_method === PaymentMethod.CASH) {
        mainCashbox.balance_cash -= amount;
      } else {
        await this.applyCardDelta(
          queryRunner.manager,
          mainCashbox,
          marketCardId as string,
          -amount,
        );
      }
      await queryRunner.manager.save(mainCashbox);

      await queryRunner.manager.save(
        queryRunner.manager.create(CashboxHistoryEntity, {
          operation_type: Operation_type.EXPENSE,
          cashbox_id: mainCashbox.id,
          source_type: Source_type.MARKET_PAYMENT,
          source_user_id: market_id, // Store market ID for tracking
          card_id: marketCardId,
          amount,
          balance_after: mainCashbox.balance,
          balance_after_cash: mainCashbox.balance_cash,
          balance_after_card: mainCashbox.balance_card,
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
        new_value: {
          amount,
          payment_method,
          counterparty_name: market.name,
        },
        description: `${market.name || 'Market'}ga ${amount} so'm to'landi (${this.getPaymentMethodLabelUz(
          payment_method,
        )})`,
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
      const courierBalanses: object[] = [];
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
      const marketCashboxes: object[] = [];
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
      const currentBalance = await calculateFinancialBalance(
        this.dataSource.manager,
      );

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
          ? {
              id: h.relatedUser.id,
              name: h.relatedUser.name,
              role: h.relatedUser.role,
            }
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
      const currentBalance = await calculateFinancialBalance(
        this.dataSource.manager,
      );

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
        .addSelect(
          'SUM(CASE WHEN h.amount > 0 THEN h.amount ELSE 0 END)',
          'positive_total',
        )
        .addSelect(
          'SUM(CASE WHEN h.amount < 0 THEN (-1 * h.amount) ELSE 0 END)',
          'negative_total',
        )
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
        .select(
          'SUM(CASE WHEN h.amount > 0 THEN h.amount ELSE 0 END)',
          'total_positive',
        )
        .addSelect(
          'SUM(CASE WHEN h.amount < 0 THEN (-1 * h.amount) ELSE 0 END)',
          'total_negative',
        )
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
          percentage:
            totalPositive > 0
              ? Math.round((Number(s.positive_total) / totalPositive) * 10000) /
                100
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
          percentage:
            totalNegative > 0
              ? Math.round((Number(s.negative_total) / totalNegative) * 10000) /
                100
              : 0,
        }))
        .sort((a, b) => b.total_amount - a.total_amount);

      // === 5. Top 10 eng katta ta'sir ===
      const topQb = this.financialHistoryRepo
        .createQueryBuilder('h')
        .leftJoinAndSelect('h.createdByUser', 'createdByUser')
        .leftJoinAndSelect('h.relatedUser', 'relatedUser')
        .addSelect(
          'CASE WHEN h.amount >= 0 THEN h.amount ELSE (-1 * h.amount) END',
          'abs_amount',
        )
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
              ? {
                  id: h.relatedUser.id,
                  name: h.relatedUser.name,
                  role: h.relatedUser.role,
                }
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

  /**
   * Eng katta ta'sir ko'rsatgan tranzaksiyalar — paginated.
   * Absolute amount bo'yicha tartiblanadi.
   */
  async financialBalanceTopImpacts(filters?: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      let fromTs: number | null = null;
      let toTs: number | null = null;

      if (filters?.fromDate) {
        fromTs = toUzbekistanTimestamp(filters.fromDate, false);
      }
      if (filters?.toDate) {
        toTs = toUzbekistanTimestamp(filters.toDate, true);
      }

      const page = Math.max(1, Number(filters?.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(filters?.limit) || 20));

      const qb = this.financialHistoryRepo
        .createQueryBuilder('h')
        .leftJoinAndSelect('h.createdByUser', 'createdByUser')
        .leftJoinAndSelect('h.relatedUser', 'relatedUser')
        .leftJoinAndSelect('h.order', 'order')
        .addSelect(
          'CASE WHEN h.amount >= 0 THEN h.amount ELSE (-1 * h.amount) END',
          'abs_amount',
        )
        .orderBy('abs_amount', 'DESC')
        .addOrderBy('h.created_at', 'DESC');

      if (fromTs !== null) {
        qb.andWhere('h.created_at >= :fromTs', { fromTs });
      }
      if (toTs !== null) {
        qb.andWhere('h.created_at <= :toTs', { toTs });
      }

      const total = await qb.getCount();
      const items = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      return successRes(
        {
          items: items.map((h) => ({
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
              ? {
                  id: h.relatedUser.id,
                  name: h.relatedUser.name,
                  role: h.relatedUser.role,
                }
              : null,
            order: h.order
              ? { id: h.order.id, total_price: h.order.total_price }
              : null,
          })),
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        200,
        'Top impact transactions',
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
      await this.requireOpenShift();
      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      // Kartali chiqim uchun virtual kartani aniqlash (CASH bo'lsa null)
      const spendCardId = await this.resolveCardForOp(
        queryRunner.manager,
        mainCashbox,
        updateCashboxDto.type,
        updateCashboxDto.card_id,
      );

      // Naqd yoki tanlangan karta balansini tekshirib ayirish
      if (updateCashboxDto.type === PaymentMethod.CASH) {
        if (mainCashbox.balance_cash < updateCashboxDto.amount) {
          throw new BadRequestException(
            `Naqd kassada yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_cash.toLocaleString()} so'm, So'ralgan: ${updateCashboxDto.amount.toLocaleString()} so'm`,
          );
        }
        mainCashbox.balance_cash -= updateCashboxDto.amount;
      } else {
        await this.applyCardDelta(
          queryRunner.manager,
          mainCashbox,
          spendCardId as string,
          -updateCashboxDto.amount,
        );
      }

      mainCashbox.balance -= updateCashboxDto.amount;
      await queryRunner.manager.save(mainCashbox);

      const cashboxHistory = queryRunner.manager.create(CashboxHistoryEntity, {
        amount: updateCashboxDto.amount,
        balance_after: mainCashbox.balance,
        balance_after_cash: mainCashbox.balance_cash,
        balance_after_card: mainCashbox.balance_card,
        cashbox_id: mainCashbox.id,
        comment: updateCashboxDto.comment,
        operation_type: Operation_type.EXPENSE,
        created_by: user.id,
        payment_method: updateCashboxDto.type,
        source_type: Source_type.MANUAL_EXPENSE,
        card_id: spendCardId,
      });
      await queryRunner.manager.save(cashboxHistory);

      // === MOLIYAVIY TAROZI: qo'lda chiqim ===
      const expBalanceAfter = await calculateFinancialBalance(
        queryRunner.manager,
      );
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
        entity_id: mainCashbox.id,
        action: 'manual_expense',
        new_value: {
          amount: updateCashboxDto.amount,
          type: updateCashboxDto.type,
          comment: updateCashboxDto.comment,
        },
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
      await this.requireOpenShift();
      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }
      // Kartali kirim uchun virtual kartani aniqlash (CASH bo'lsa null)
      const fillCardId = await this.resolveCardForOp(
        queryRunner.manager,
        mainCashbox,
        updateCashboxDto.type,
        updateCashboxDto.card_id,
      );

      mainCashbox.balance += updateCashboxDto.amount;
      // Naqd yoki tanlangan virtual kartaga qo'shish
      if (updateCashboxDto.type === PaymentMethod.CASH) {
        mainCashbox.balance_cash += updateCashboxDto.amount;
      } else {
        await this.applyCardDelta(
          queryRunner.manager,
          mainCashbox,
          fillCardId as string,
          updateCashboxDto.amount,
        );
      }
      await queryRunner.manager.save(mainCashbox);

      const cashboxHistory = queryRunner.manager.create(CashboxHistoryEntity, {
        amount: updateCashboxDto.amount,
        balance_after: mainCashbox.balance,
        balance_after_cash: mainCashbox.balance_cash,
        balance_after_card: mainCashbox.balance_card,
        cashbox_id: mainCashbox.id,
        comment: updateCashboxDto.comment,
        operation_type: Operation_type.INCOME,
        created_by: user.id,
        payment_method: updateCashboxDto.type,
        source_type: Source_type.MANUAL_INCOME,
        card_id: fillCardId,
      });
      await queryRunner.manager.save(cashboxHistory);

      // === MOLIYAVIY TAROZI: qo'lda kirim ===
      const fillBalanceAfter = await calculateFinancialBalance(
        queryRunner.manager,
      );
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
        entity_id: mainCashbox.id,
        action: 'manual_income',
        new_value: {
          amount: updateCashboxDto.amount,
          type: updateCashboxDto.type,
          comment: updateCashboxDto.comment,
        },
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
      await this.requireOpenShift();
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

      // Kartali maosh uchun virtual kartani aniqlash (CASH bo'lsa null)
      const salaryCardId = await this.resolveCardForOp(
        queryRunner.manager,
        mainCashbox,
        salaryDto.type,
        salaryDto.card_id,
      );

      // Naqd balansini tekshirish (karta yetarliligi quyida applyCardDelta
      // ichida pessimistic lock bilan, tanlangan karta bo'yicha tekshiriladi)
      if (salaryDto.type === PaymentMethod.CASH) {
        if (mainCashbox.balance_cash < amount) {
          throw new BadRequestException(
            `Naqd kassada yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_cash.toLocaleString()} so'm, So'ralgan: ${amount.toLocaleString()} so'm`,
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
      // Naqd yoki tanlangan virtual kartadan ayirish
      if (salaryDto.type === PaymentMethod.CASH) {
        mainCashbox.balance_cash -= amount;
      } else {
        await this.applyCardDelta(
          queryRunner.manager,
          mainCashbox,
          salaryCardId as string,
          -amount,
        );
      }
      await queryRunner.manager.save(mainCashbox);

      const cashboxHistory = queryRunner.manager.create(CashboxHistoryEntity, {
        amount,
        balance_after: mainCashbox.balance,
        balance_after_cash: mainCashbox.balance_cash,
        balance_after_card: mainCashbox.balance_card,
        cashbox_id: mainCashbox.id,
        comment:
          salaryDto?.comment || `${staff?.name || 'Hodim'} ga maosh to'landi`,
        created_by: user.id,
        payment_method: salaryDto.type,
        operation_type: Operation_type.EXPENSE,
        source_type: Source_type.SALARY,
        source_user_id: user_id,
        card_id: salaryCardId,
      });
      await queryRunner.manager.save(cashboxHistory);

      // === MOLIYAVIY TAROZI: maosh to'lovi ===
      const salaryBalanceAfter = await calculateFinancialBalance(
        queryRunner.manager,
      );
      await queryRunner.manager.save(
        queryRunner.manager.create(FinancialBalanceHistoryEntity, {
          amount: -amount,
          balance_before: salaryBalanceAfter + amount,
          balance_after: salaryBalanceAfter,
          source_type: FinancialSource_type.SALARY,
          related_user_id: user_id,
          comment:
            salaryDto?.comment || `${staff?.name || 'Hodim'} ga maosh to'landi`,
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

  /**
   * Kassadan INVESTORga foyda taqsimoti to'lash.
   * Maosh/chiqim kabi kassadan yechadi + cashbox_history (EXPENSE) yozadi
   * (invariant uchun MAJBURIY), va investor_distribution ledgeriga yozadi —
   * BITTA tranzaksiyada. LEKIN financial_balance_history'ga YOZMAYDI: bu foyda
   * taqsimoti, biznes xarajati (OpEx) EMAS — shuning uchun sof foydani kamaytirmaydi.
   */
  async payInvestor(user: JwtPayload, dto: PayInvestorDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.requireOpenShift();
      const { investor_id, amount } = dto;
      const investor = await queryRunner.manager.findOne(UserEntity, {
        where: { id: investor_id },
      });
      if (!investor) throw new NotFoundException('Investor topilmadi');
      if (investor.role !== Roles.INVESTOR) {
        throw new BadRequestException('Bu foydalanuvchi investor emas');
      }
      const mainCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) throw new NotFoundException('Main cashbox not found');

      const cardId = await this.resolveCardForOp(
        queryRunner.manager,
        mainCashbox,
        dto.type,
        dto.card_id,
      );

      const isCash = !dto.type || dto.type === PaymentMethod.CASH;
      if (isCash) {
        if (mainCashbox.balance_cash < amount) {
          throw new BadRequestException(
            `Naqd kassada yetarli mablag' yo'q! Mavjud: ${mainCashbox.balance_cash.toLocaleString()} so'm, So'ralgan: ${amount.toLocaleString()} so'm`,
          );
        }
        mainCashbox.balance_cash -= amount;
      } else {
        await this.applyCardDelta(
          queryRunner.manager,
          mainCashbox,
          cardId as string,
          -amount,
        );
      }
      mainCashbox.balance -= amount;
      await queryRunner.manager.save(mainCashbox);

      const comment =
        dto.comment || `${investor.name || 'Investor'} ga foyda taqsimoti`;

      // Kassa tarixi — EXPENSE (invariant uchun MAJBURIY).
      await queryRunner.manager.save(
        queryRunner.manager.create(CashboxHistoryEntity, {
          amount,
          balance_after: mainCashbox.balance,
          balance_after_cash: mainCashbox.balance_cash,
          balance_after_card: mainCashbox.balance_card,
          cashbox_id: mainCashbox.id,
          comment,
          created_by: user.id,
          payment_method: dto.type,
          operation_type: Operation_type.EXPENSE,
          source_type: Source_type.INVESTOR_PAYOUT,
          source_user_id: investor_id,
          card_id: cardId,
        }),
      );

      // Investor ledger — taqsimot (append-only). ATAYLAB FBH/OpEx yo'q.
      await queryRunner.manager.save(
        queryRunner.manager.create(InvestorDistributionEntity, {
          investor_id,
          amount,
          distributed_at: Date.now(),
          note: dto.note ?? dto.comment ?? null,
          created_by: user.id,
        }),
      );

      await queryRunner.commitTransaction();
      this.activityLog.log({
        entity_type: 'cashbox',
        entity_id: investor_id,
        action: 'investor_payout',
        new_value: { amount, investor_name: investor.name },
        description: `Investorga to'lov: ${investor.name || ''} — ${amount} so'm`,
        user,
      });
      return successRes({}, 200, 'Investor payout paid');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Ishchining maosh to'lovlari tarixi.
   * `cashbox_history` dagi SALARY yozuvlaridan o'qiydi (source_user_id = ishchi).
   * Admin (har qanday ishchi uchun) va ishchining o'zi (my-history) ishlatadi.
   */
  async salaryHistory(
    userId: string,
    filters?: {
      page?: number;
      limit?: number;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    try {
      const staff = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['salary'],
      });
      if (!staff) {
        throw new NotFoundException('User not found');
      }

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

      const qb = this.cashboxHistoryRepo
        .createQueryBuilder('h')
        .leftJoinAndSelect('h.createdByUser', 'createdByUser')
        .where('h.source_type = :st', { st: Source_type.SALARY })
        .andWhere('h.source_user_id = :uid', { uid: userId })
        .orderBy('h.created_at', 'DESC')
        .skip(skip)
        .take(limit);

      if (fromTs !== null) {
        qb.andWhere('h.created_at >= :fromTs', { fromTs });
      }
      if (toTs !== null) {
        qb.andWhere('h.created_at <= :toTs', { toTs });
      }

      const [items, total] = await qb.getManyAndCount();

      // Jami to'langan summa (sana filtridan mustaqil — umumiy)
      const totalPaidRaw = await this.cashboxHistoryRepo
        .createQueryBuilder('h')
        .select('COALESCE(SUM(h.amount), 0)', 'sum')
        .where('h.source_type = :st', { st: Source_type.SALARY })
        .andWhere('h.source_user_id = :uid', { uid: userId })
        .getRawOne();

      const history = items.map((h) => ({
        id: h.id,
        created_at: h.created_at,
        amount: h.amount,
        payment_method: h.payment_method,
        comment: h.comment,
        paid_by: h.createdByUser
          ? { id: h.createdByUser.id, name: h.createdByUser.name }
          : null,
      }));

      return successRes(
        {
          user: { id: staff.id, name: staff.name, role: staff.role },
          salary: staff.salary
            ? {
                salary_amount: staff.salary.salary_amount,
                have_to_pay: staff.salary.have_to_pay,
                payment_day: staff.salary.payment_day,
              }
            : null,
          totalPaid: Number(totalPaidRaw?.sum ?? 0),
          history,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        200,
        'Salary payment history',
      );
    } catch (error) {
      return catchError(error);
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
    // 1. Ma'lumotni olish
    const result = query.allHistory
      ? await this.getAllMainCashboxHistory()
      : await this.getMainCashbox({
          fromDate: query.fromDate,
          toDate: query.toDate,
        });
    const data = result.data;
    const { cashbox, cashboxHistory } = data;
    const cards: CashboxCardEntity[] = data.cards || [];

    // 2. Tranzaksiyalar — xronologik tartib (eski → yangi)
    const history = [...cashboxHistory].sort(
      (a, b) => Number(a.created_at) - Number(b.created_at),
    );

    // 3. Kirim/chiqim naqd/karta ajratimi — BARCHA turlar bo'yicha
    //    (frontenddagi income/outcome bilan AYNAN mos; qatorlar yig'indisi = jami)
    const split = this.computeMethodSplit(history);

    // 4. Yopilish balansi — davr "hozir"ni qamrasa JONLI balansdan
    //    (frontend kassa kartasi bilan aynan mos), aks holda davrdagi
    //    oxirgi tranzaksiya snapshot'idan. Taxmin (* 0.6) ISHLATILMAYDI.
    const rangeIncludesNow =
      query.allHistory ||
      !query.toDate ||
      Number(toUzbekistanTimestamp(query.toDate, true)) >= Date.now();
    const live = {
      cash: cashbox.balance_cash ?? 0,
      card: cashbox.balance_card ?? 0,
      total: cashbox.balance ?? 0,
    };
    let closing = live;
    if (!rangeIncludesNow && history.length) {
      const last = history[history.length - 1];
      closing = {
        cash: last.balance_after_cash ?? live.cash,
        card: last.balance_after_card ?? live.card,
        total: last.balance_after ?? live.total,
      };
    }

    // 5. Ochilish balansi — davrdagi birinchi yozuv snapshot'idan, taxminsiz
    let opening = { cash: 0, card: 0, total: 0 };
    if (!query.allHistory && history.length) {
      const first = history[0];
      if (first.balance_after_cash != null && first.balance_after_card != null) {
        const d = this.txDelta(first);
        opening = {
          cash: first.balance_after_cash - d.cash,
          card: first.balance_after_card - d.card,
          total: (first.balance_after ?? 0) - d.total,
        };
      } else {
        // Eski (migratsiyagacha) yozuvlar uchun zaxira: yopilish − sof harakat
        opening = {
          cash: closing.cash - split.income.cash + split.expense.cash,
          card: closing.card - split.income.card + split.expense.card,
          total: closing.total - split.income.total + split.expense.total,
        };
      }
    }

    // 6. Konvertatsiya (naqd ↔ karta) — kirim/chiqimsiz ajratim siljishi
    const conversion = {
      cash:
        closing.cash - (opening.cash + split.income.cash - split.expense.cash),
      card:
        closing.card - (opening.card + split.income.card - split.expense.card),
    };

    // 7. Davr yorlig'i
    const periodLabel = query.allHistory
      ? 'Umumiy tarix'
      : query.fromDate && query.toDate
        ? query.fromDate === query.toDate
          ? query.fromDate
          : `${query.fromDate} — ${query.toDate}`
        : 'Bugungi kun';

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Asosiy kassa');
    this.buildMainCashboxSheet(worksheet, {
      title: 'ASOSIY KASSA — Hisobot',
      subtitle: `Davr: ${periodLabel}`,
      recon: {
        opening,
        income: split.income,
        expense: split.expense,
        conversion,
        closing,
      },
      cards: cards.map((c) => ({ name: c.name, balance: c.balance ?? 0 })),
      cardTotal: live.card,
      history,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any;
  }

  /**
   * Bitta kuryer yoki market kassasi tarixini Excel'ga eksport qiladi.
   * - Sana berilmasa (allHistory) — butun tarix.
   * - sourceTypes berilsa (masalan oldi-berdi) — faqat shu turlar.
   * Kuryer/market kassasi yagona balansli (naqd/karta ajratimsiz),
   * shuning uchun asosiy kassadan farqli, sodda bitta jadval quriladi.
   */
  async exportUserCashboxToExcel(
    id: string,
    query: {
      fromDate?: string;
      toDate?: string;
      sourceTypes?: string;
      allHistory?: boolean;
    },
  ): Promise<{ buffer: Buffer; fileName: string }> {
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

    const whereCondition: any = { cashbox_id: cashbox.id };

    // Sana oralig'i (allHistory bo'lmaganda)
    let periodLabel = 'Umumiy tarix';
    if (!query.allHistory) {
      let startDate = query.fromDate;
      let endDate = query.toDate;
      if (!startDate || !endDate) {
        const { start, end } = getUzbekistanDayRange();
        startDate = String(start);
        endDate = String(end);
        periodLabel = 'Bugungi kun';
      } else {
        const start = toUzbekistanTimestamp(startDate, false);
        const end = toUzbekistanTimestamp(endDate, true);
        periodLabel =
          query.fromDate === query.toDate
            ? `${query.fromDate}`
            : `${query.fromDate} — ${query.toDate}`;
        startDate = String(start);
        endDate = String(end);
      }
      whereCondition.created_at = Between(Number(startDate), Number(endDate));
    }

    // source_type filter (oldi-berdi va h.k.)
    const sourceTypeList = query.sourceTypes
      ? query.sourceTypes.split(',').filter(Boolean)
      : [];
    if (sourceTypeList.length) {
      whereCondition.source_type = In(sourceTypeList);
    }

    const cashboxHistory = await this.cashboxHistoryRepo.find({
      where: whereCondition,
      relations: ['createdByUser', 'sourceUser', 'order'],
      order: { created_at: 'ASC' },
    });

    let income = 0;
    let outcome = 0;
    for (const h of cashboxHistory) {
      if (h.operation_type === Operation_type.INCOME) income += h.amount ?? 0;
      else outcome += h.amount ?? 0;
    }

    // Oldi-berdi tab'ini aniqlash (faqat to'lov turlari tanlangan bo'lsa)
    const isPaymentsOnly =
      sourceTypeList.length > 0 &&
      sourceTypeList.every(
        (t) =>
          t === Source_type.COURIER_PAYMENT ||
          t === Source_type.MARKET_PAYMENT,
      );

    const roleLabel = cashbox.user?.role === Roles.MARKET ? 'Market' : 'Kuryer';
    const filterLabel = isPaymentsOnly ? 'Oldi-berdi' : 'Barcha tarix';

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Kassa tarixi');
    this.buildUserCashboxSheet(worksheet, {
      userName: user.name || cashbox.user?.name || 'Nomalum',
      roleLabel,
      periodLabel,
      filterLabel,
      currentBalance: cashbox.balance ?? 0,
      income,
      outcome,
      cashboxHistory,
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const safeName = (user.name || roleLabel).replace(/[^\p{L}\p{N}_-]+/gu, '_');
    const periodPart = query.allHistory
      ? 'umumiy'
      : query.fromDate && query.toDate
        ? query.fromDate === query.toDate
          ? query.fromDate
          : `${query.fromDate}_${query.toDate}`
        : 'bugun';
    const fileName = `kassa-${safeName}-${periodPart}.xlsx`;

    return { buffer: buffer as any, fileName };
  }

  /** source_type uchun o'zbekcha yorliq (frontend bilan mos) */
  private getSourceTypeLabelUz(sourceType: string): string {
    const labels: Record<string, string> = {
      [Source_type.COURIER_PAYMENT]: "Kuryer to'lovi",
      [Source_type.MARKET_PAYMENT]: "Market to'lovi",
      [Source_type.MANUAL_EXPENSE]: "Qo'lda chiqim",
      [Source_type.MANUAL_INCOME]: "Qo'lda kirim",
      [Source_type.CORRECTION]: 'Tuzatish',
      [Source_type.SALARY]: 'Maosh',
      [Source_type.SELL]: 'Sotuv',
      [Source_type.CANCEL]: 'Bekor qilish',
      [Source_type.EXTRA_COST]: "Qo'shimcha xarajat",
      [Source_type.BILLS]: "To'lovlar",
      [Source_type.INVESTOR_PAYOUT]: 'Investorga to\'lov',
    };
    return labels[sourceType] || sourceType;
  }

  /** to'lov usuli uchun o'zbekcha yorliq */
  private getPaymentMethodLabelUz(method: string | null): string {
    switch (method) {
      case PaymentMethod.CASH:
        return 'Naqd';
      case PaymentMethod.CLICK:
        return 'Karta (Click)';
      case PaymentMethod.CLICK_TO_MARKET:
        return 'Karta (Marketga)';
      default:
        return '-';
    }
  }

  /** bigint ms timestamp'ni UZB (UTC+5) bo'yicha o'qiladigan ko'rinishga aylantiradi */
  private formatUzDateTime(ts: number | string): string {
    const d = new Date(Number(ts) + 5 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
      d.getUTCDate(),
    )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }

  /**
   * Kuryer/market kassasi tarixini bitta jadval ko'rinishida quradi.
   */
  private buildUserCashboxSheet(
    worksheet: ExcelJS.Worksheet,
    data: {
      userName: string;
      roleLabel: string;
      periodLabel: string;
      filterLabel: string;
      currentBalance: number;
      income: number;
      outcome: number;
      cashboxHistory: CashboxHistoryEntity[];
    },
  ) {
    // Summalar MING so'mda: qiymat 1000 ga bo'linadi va formatlanadi
    // (masalan 1 000 000 → "1 000"). Kasr bo'lsa ".###" uni ko'rsatadi.
    const NUM_FMT = '#,##0.###';
    const K = (n: number) => (Number(n) || 0) / 1000;
    const COLS = 9; // A..I
    const lastColLetter = 'I';
    const border = {
      top: { style: 'thin' as const, color: { argb: 'FFB0B0B0' } },
      left: { style: 'thin' as const, color: { argb: 'FFB0B0B0' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFB0B0B0' } },
      right: { style: 'thin' as const, color: { argb: 'FFB0B0B0' } },
    };

    // Ustun kengliklari
    const widths = [6, 18, 12, 18, 16, 16, 16, 18, 30];
    widths.forEach((w, i) => (worksheet.getColumn(i + 1).width = w));

    // ===== ROW 1: Sarlavha =====
    worksheet.mergeCells(`A1:${lastColLetter}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${data.userName} — ${data.roleLabel} kassasi`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6D28D9' },
    };
    worksheet.getRow(1).height = 26;

    // ===== ROW 2: Davr va filtr =====
    worksheet.mergeCells(`A2:${lastColLetter}2`);
    const subCell = worksheet.getCell('A2');
    subCell.value = `Davr: ${data.periodLabel}    |    Ko'rinish: ${data.filterLabel}    |    Summalar — ming soʻmda`;
    subCell.font = { bold: true, size: 11, color: { argb: 'FF4B5563' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEDE9FE' },
    };
    worksheet.getRow(2).height = 20;

    // ===== ROW 3: Xulosa (Jami kirim / chiqim / sof / joriy balans) =====
    const summary: Array<[string, string, number, string]> = [
      ['A3', 'B3', K(data.income), 'FFDCFCE7'],
      ['C3', 'D3', K(data.outcome), 'FFFEE2E2'],
      ['E3', 'F3', K(data.income - data.outcome), 'FFFEF9C3'],
      ['G3', 'H3', K(data.currentBalance), 'FFDBEAFE'],
    ];
    const summaryTitles = [
      'Jami kirim',
      'Jami chiqim',
      'Sof oʻzgarish',
      'Joriy balans',
    ];
    summary.forEach(([labelCell, valCell, value, bg], idx) => {
      const lc = worksheet.getCell(labelCell);
      lc.value = summaryTitles[idx];
      lc.font = { bold: true, size: 10 };
      lc.alignment = { horizontal: 'left', vertical: 'middle' };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      lc.border = border;

      const vc = worksheet.getCell(valCell);
      vc.value = value;
      vc.numFmt = NUM_FMT;
      vc.font = { bold: true, size: 10 };
      vc.alignment = { horizontal: 'right', vertical: 'middle' };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      vc.border = border;
    });
    // I3 bo'sh — chegara
    worksheet.getCell('I3').border = border;
    worksheet.getRow(3).height = 20;

    // ===== ROW 5: Jadval sarlavhasi =====
    const headerRowIdx = 5;
    const headers = [
      '№',
      'Sana / vaqt',
      'Amaliyot',
      'Turi',
      'Summa (ming soʻm)',
      "To'lov usuli",
      'Balans (ming soʻm)',
      'Buyurtma №',
      'Izoh',
    ];
    const headerRow = worksheet.getRow(headerRowIdx);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7C3AED' },
      };
      cell.border = border;
    });
    headerRow.height = 22;

    // ===== DATA ROWS =====
    let rowIdx = headerRowIdx + 1;
    data.cashboxHistory.forEach((tx, i) => {
      const isIncome = tx.operation_type === Operation_type.INCOME;
      const row = worksheet.getRow(rowIdx);

      // Turi — click_to_market o'tkazmasida pul kimga/kimdan ketganini ham qo'shamiz
      let typeLabel = this.getSourceTypeLabelUz(tx.source_type);
      if (
        tx.payment_method === PaymentMethod.CLICK_TO_MARKET &&
        tx.sourceUser?.name
      ) {
        typeLabel = `${typeLabel} ${isIncome ? '←' : '→'} ${tx.sourceUser.name}`;
      }

      const values: Array<string | number> = [
        i + 1,
        this.formatUzDateTime(tx.created_at),
        isIncome ? 'Kirim' : 'Chiqim',
        typeLabel,
        K(tx.amount),
        this.getPaymentMethodLabelUz(tx.payment_method),
        K(tx.balance_after),
        tx.order?.order_number ? `#${tx.order.order_number}` : '-',
        tx.comment || '-',
      ];
      values.forEach((v, c) => {
        const cell = row.getCell(c + 1);
        cell.value = v;
        cell.font = { size: 10 };
        cell.border = border;
        if (c === 4 || c === 6) {
          // Summa va Balans — raqam, o'ngga
          cell.numFmt = NUM_FMT;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (c === 0 || c === 2 || c === 5 || c === 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: c === 8,
          };
        }
      });
      // Amaliyot ustuni rangi
      const opCell = row.getCell(3);
      opCell.font = {
        size: 10,
        bold: true,
        color: { argb: isIncome ? 'FF16A34A' : 'FFDC2626' },
      };
      // zebra
      if (i % 2 === 1) {
        for (let c = 1; c <= COLS; c++) {
          if (c === 3) continue;
          row.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F3FF' },
          };
        }
      }
      rowIdx++;
    });

    // Bo'sh tarix holati
    if (data.cashboxHistory.length === 0) {
      worksheet.mergeCells(`A${rowIdx}:${lastColLetter}${rowIdx}`);
      const emptyCell = worksheet.getCell(`A${rowIdx}`);
      emptyCell.value = 'Tanlangan davr uchun maʼlumot topilmadi';
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      emptyCell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
      emptyCell.border = border;
      rowIdx++;
    }

    // ===== JAMI qatori =====
    const totalRow = worksheet.getRow(rowIdx);
    totalRow.getCell(1).value = 'JAMI';
    worksheet.mergeCells(`A${rowIdx}:D${rowIdx}`);
    const totalLabel = worksheet.getCell(`A${rowIdx}`);
    totalLabel.font = { bold: true, size: 11 };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const incomeMinusOutcome = data.income - data.outcome;
    const totalAmountCell = totalRow.getCell(5);
    totalAmountCell.value = K(incomeMinusOutcome);
    totalAmountCell.numFmt = NUM_FMT;
    totalAmountCell.font = {
      bold: true,
      size: 11,
      color: {
        argb: incomeMinusOutcome >= 0 ? 'FF16A34A' : 'FFDC2626',
      },
    };
    totalAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalBalanceCell = totalRow.getCell(7);
    totalBalanceCell.value = K(data.currentBalance);
    totalBalanceCell.numFmt = NUM_FMT;
    totalBalanceCell.font = { bold: true, size: 11 };
    totalBalanceCell.alignment = { horizontal: 'right', vertical: 'middle' };

    for (let c = 1; c <= COLS; c++) {
      const cell = totalRow.getCell(c);
      cell.border = border;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      };
    }
    totalRow.height = 22;

    // Yuqori qatorni muzlatish (sarlavha doim ko'rinadi)
    worksheet.views = [{ state: 'frozen', ySplit: headerRowIdx }];
  }

  /**
   * Asosiy kassa / smena hisoboti uchun YAGONA, toza Excel varag'ini quradi.
   * Kuryer/market kassasi (buildUserCashboxSheet) uslubida, lekin naqd/karta
   * ajratimini hisobga oladi. Uch bo'lim:
   *   1) Rekonsiliatsiya matritsasi: (Ochilish → Kirim → Chiqim → Konvertatsiya
   *      → Yopilish) × (Naqd / Karta / Jami) — sonlar doim o'zaro mos keladi
   *      (Yopilish = Ochilish + Kirim − Chiqim + Konvertatsiya);
   *   2) Kartalar bo'yicha joriy qoldiq;
   *   3) Toza yagona tranzaksiya jadvali (Turi, Buyurtma № va Izoh bilan).
   * Asosiy kassa ham, smena ham AYNAN shu builder'dan foydalanadi.
   */
  private buildMainCashboxSheet(
    worksheet: ExcelJS.Worksheet,
    data: {
      title: string;
      subtitle: string;
      recon: {
        opening: { cash: number; card: number; total: number };
        income: { cash: number; card: number; total: number };
        expense: { cash: number; card: number; total: number };
        conversion: { cash: number; card: number };
        closing: { cash: number; card: number; total: number };
      };
      cards: Array<{ name: string; balance: number }>;
      cardTotal: number;
      history: CashboxHistoryEntity[];
    },
  ) {
    // Summalar MING so'mda ko'rsatiladi: qiymat 1000 ga bo'linadi va formatlanadi
    // (masalan 1 000 000 → "1 000"). Kasr qiymat bo'lsa, ".###" uni ko'rsatadi.
    const NUM_FMT = '#,##0.###';
    const K = (n: number) => (Number(n) || 0) / 1000;
    const COLS = 9; // A..I
    const lastCol = 'I';
    const thin = { style: 'thin' as const, color: { argb: 'FFB0B0B0' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const fill = (argb: string) =>
      ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const;

    const widths = [6, 18, 11, 22, 16, 16, 17, 13, 30];
    widths.forEach((w, i) => (worksheet.getColumn(i + 1).width = w));

    let r = 1;

    // ===== Sarlavha =====
    worksheet.mergeCells(`A${r}:${lastCol}${r}`);
    const titleCell = worksheet.getCell(`A${r}`);
    titleCell.value = data.title;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = fill('FF6D28D9');
    worksheet.getRow(r).height = 26;
    r++;

    // ===== Davr / izoh =====
    worksheet.mergeCells(`A${r}:${lastCol}${r}`);
    const subCell = worksheet.getCell(`A${r}`);
    subCell.value = `${data.subtitle}  ·  Summalar — ming soʻmda`;
    subCell.font = { bold: true, size: 10, color: { argb: 'FF4B5563' } };
    subCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    subCell.fill = fill('FFEDE9FE');
    worksheet.getRow(r).height = 20;
    r += 2; // bo'sh qator

    // ===== Rekonsiliatsiya matritsasi =====
    const mh = worksheet.getRow(r);
    worksheet.mergeCells(`A${r}:F${r}`);
    const mhLabel = worksheet.getCell(`A${r}`);
    mhLabel.value = 'Hisob-kitob (rekonsiliatsiya), ming soʻm';
    mhLabel.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    mhLabel.alignment = { horizontal: 'left', vertical: 'middle' };
    mhLabel.fill = fill('FF7C3AED');
    (['G', 'H', 'I'] as const).forEach((col, i) => {
      const c = worksheet.getCell(`${col}${r}`);
      c.value = ['Naqd', 'Karta', 'Jami'][i];
      c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      c.alignment = { horizontal: 'right', vertical: 'middle' };
      c.fill = fill('FF7C3AED');
    });
    for (let c = 1; c <= COLS; c++) mh.getCell(c).border = border;
    mh.height = 20;
    r++;

    const matrix: Array<{
      label: string;
      cash: number;
      card: number;
      total: number;
      bg: string;
      color?: string;
      bold?: boolean;
    }> = [
      {
        label: 'Ochilish balansi',
        cash: data.recon.opening.cash,
        card: data.recon.opening.card,
        total: data.recon.opening.total,
        bg: 'FFF3F4F6',
      },
      {
        label: 'Kirim (+)',
        cash: data.recon.income.cash,
        card: data.recon.income.card,
        total: data.recon.income.total,
        bg: 'FFDCFCE7',
        color: 'FF16A34A',
      },
      {
        label: 'Chiqim (−)',
        cash: data.recon.expense.cash,
        card: data.recon.expense.card,
        total: data.recon.expense.total,
        bg: 'FFFEE2E2',
        color: 'FFDC2626',
      },
      {
        label: 'Konvertatsiya (naqd ↔ karta)',
        cash: data.recon.conversion.cash,
        card: data.recon.conversion.card,
        total: data.recon.conversion.cash + data.recon.conversion.card,
        bg: 'FFEFF6FF',
      },
      {
        label: 'Yopilish balansi',
        cash: data.recon.closing.cash,
        card: data.recon.closing.card,
        total: data.recon.closing.total,
        bg: 'FFDBEAFE',
        bold: true,
      },
    ];
    matrix.forEach((m) => {
      const row = worksheet.getRow(r);
      worksheet.mergeCells(`A${r}:F${r}`);
      const lc = worksheet.getCell(`A${r}`);
      lc.value = m.label;
      lc.font = { bold: m.bold || false, size: 10 };
      lc.alignment = { horizontal: 'left', vertical: 'middle' };
      lc.fill = fill(m.bg);
      (['G', 'H', 'I'] as const).forEach((col, i) => {
        const c = worksheet.getCell(`${col}${r}`);
        c.value = K([m.cash, m.card, m.total][i]);
        c.numFmt = NUM_FMT;
        c.font = {
          bold: m.bold || false,
          size: 10,
          color: m.color ? { argb: m.color } : undefined,
        };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        c.fill = fill(m.bg);
      });
      for (let c = 1; c <= COLS; c++) row.getCell(c).border = border;
      r++;
    });
    r++; // bo'sh qator

    // ===== Kartalar bo'yicha joriy qoldiq =====
    if (data.cards.length) {
      worksheet.mergeCells(`A${r}:${lastCol}${r}`);
      const ct = worksheet.getCell(`A${r}`);
      ct.value = 'Kartalar bo‘yicha joriy qoldiq, ming soʻm';
      ct.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      ct.alignment = { horizontal: 'left', vertical: 'middle' };
      ct.fill = fill('FF7C3AED');
      for (let c = 1; c <= COLS; c++)
        worksheet.getRow(r).getCell(c).border = border;
      r++;

      data.cards.forEach((card, idx) => {
        const row = worksheet.getRow(r);
        worksheet.mergeCells(`A${r}:H${r}`);
        const nc = worksheet.getCell(`A${r}`);
        nc.value = card.name;
        nc.font = { size: 10 };
        nc.alignment = { horizontal: 'left', vertical: 'middle' };
        const vc = worksheet.getCell(`I${r}`);
        vc.value = K(card.balance);
        vc.numFmt = NUM_FMT;
        vc.font = { size: 10 };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        if (idx % 2 === 1) {
          for (let c = 1; c <= COLS; c++)
            row.getCell(c).fill = fill('FFF5F3FF');
        }
        for (let c = 1; c <= COLS; c++) row.getCell(c).border = border;
        r++;
      });

      // JAMI (= karta balansi)
      const trow = worksheet.getRow(r);
      worksheet.mergeCells(`A${r}:H${r}`);
      const tl = worksheet.getCell(`A${r}`);
      tl.value = 'JAMI (karta balansi)';
      tl.font = { bold: true, size: 10 };
      tl.alignment = { horizontal: 'right', vertical: 'middle' };
      const tv = worksheet.getCell(`I${r}`);
      tv.value = K(data.cardTotal);
      tv.numFmt = NUM_FMT;
      tv.font = { bold: true, size: 10 };
      tv.alignment = { horizontal: 'right', vertical: 'middle' };
      for (let c = 1; c <= COLS; c++) {
        const cell = trow.getCell(c);
        cell.border = border;
        cell.fill = fill('FFE5E7EB');
      }
      r += 2; // bo'sh qator
    }

    // ===== Tranzaksiyalar jadvali =====
    const headers = [
      '№',
      'Sana / vaqt',
      'Amaliyot',
      'Turi',
      "To'lov usuli",
      'Summa (ming soʻm)',
      'Balans (ming soʻm)',
      'Buyurtma №',
      'Izoh',
    ];
    const headerRow = worksheet.getRow(r);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.fill = fill('FF7C3AED');
      cell.border = border;
    });
    headerRow.height = 22;
    r++;

    data.history.forEach((tx, i) => {
      const isIncome = tx.operation_type === Operation_type.INCOME;
      const row = worksheet.getRow(r);

      // CLICK_TO_MARKET o'tib ketuvchi to'lovda pul kimga/kimdan ketganini ko'rsatamiz
      let typeLabel = this.getSourceTypeLabelUz(tx.source_type);
      if (
        tx.payment_method === PaymentMethod.CLICK_TO_MARKET &&
        tx.sourceUser?.name
      ) {
        typeLabel = `${typeLabel} ${isIncome ? '←' : '→'} ${tx.sourceUser.name}`;
      }

      const values: Array<string | number> = [
        i + 1,
        this.formatUzDateTime(tx.created_at),
        isIncome ? 'Kirim' : 'Chiqim',
        typeLabel,
        this.getPaymentMethodLabelUz(tx.payment_method),
        K(tx.amount),
        K(tx.balance_after),
        tx.order?.order_number ? `#${tx.order.order_number}` : '-',
        tx.comment || '-',
      ];
      values.forEach((v, c) => {
        const cell = row.getCell(c + 1);
        cell.value = v;
        cell.font = { size: 10 };
        cell.border = border;
        if (c === 5 || c === 6) {
          // Summa va Balans — raqam, o'ngga
          cell.numFmt = NUM_FMT;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (c === 0 || c === 2 || c === 4 || c === 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: c === 8,
          };
        }
      });
      // Amaliyot ustuni rangi
      row.getCell(3).font = {
        size: 10,
        bold: true,
        color: { argb: isIncome ? 'FF16A34A' : 'FFDC2626' },
      };
      // zebra
      if (i % 2 === 1) {
        for (let c = 1; c <= COLS; c++) {
          if (c === 3) continue;
          row.getCell(c).fill = fill('FFF5F3FF');
        }
      }
      r++;
    });

    if (data.history.length === 0) {
      worksheet.mergeCells(`A${r}:${lastCol}${r}`);
      const ec = worksheet.getCell(`A${r}`);
      ec.value = 'Tanlangan davr uchun maʼlumot topilmadi';
      ec.alignment = { horizontal: 'center', vertical: 'middle' };
      ec.font = { italic: true, color: { argb: 'FF9CA3AF' } };
      ec.border = border;
      r++;
    }

    // ===== JAMI qatori =====
    const totalRow = worksheet.getRow(r);
    worksheet.mergeCells(`A${r}:E${r}`);
    const tlabel = worksheet.getCell(`A${r}`);
    tlabel.value = 'JAMI (kirim − chiqim)';
    tlabel.font = { bold: true, size: 11 };
    tlabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const net = data.recon.income.total - data.recon.expense.total;
    const netCell = totalRow.getCell(6);
    netCell.value = K(net);
    netCell.numFmt = NUM_FMT;
    netCell.font = {
      bold: true,
      size: 11,
      color: { argb: net >= 0 ? 'FF16A34A' : 'FFDC2626' },
    };
    netCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const balCell = totalRow.getCell(7);
    balCell.value = K(data.recon.closing.total);
    balCell.numFmt = NUM_FMT;
    balCell.font = { bold: true, size: 11 };
    balCell.alignment = { horizontal: 'right', vertical: 'middle' };

    for (let c = 1; c <= COLS; c++) {
      const cell = totalRow.getCell(c);
      cell.border = border;
      cell.fill = fill('FFE5E7EB');
    }
    totalRow.height = 22;
  }

  /**
   * Tranzaksiya tarixini operation_type bo'yicha naqd/karta'ga ajratadi.
   * total = barcha kirim/chiqim yig'indisi (frontenddagi income/outcome bilan
   * AYNAN mos); cash = naqd yozuvlar; card = total − cash. Shu sabab cash+card
   * doim total'ga teng bo'ladi va ajratim izchil qoladi.
   */
  private computeMethodSplit(history: CashboxHistoryEntity[]) {
    let incCash = 0;
    let incTotal = 0;
    let expCash = 0;
    let expTotal = 0;
    for (const tx of history) {
      const amt = tx.amount ?? 0;
      if (tx.operation_type === Operation_type.INCOME) {
        incTotal += amt;
        if (tx.payment_method === PaymentMethod.CASH) incCash += amt;
      } else {
        expTotal += amt;
        if (tx.payment_method === PaymentMethod.CASH) expCash += amt;
      }
    }
    return {
      income: { cash: incCash, card: incTotal - incCash, total: incTotal },
      expense: { cash: expCash, card: expTotal - expCash, total: expTotal },
    };
  }

  /**
   * Bitta tranzaksiyaning naqd/karta/jami balansga (ishorali) ta'sirini qaytaradi.
   */
  private txDelta(tx: CashboxHistoryEntity) {
    const amt = tx.amount ?? 0;
    const sign = tx.operation_type === Operation_type.INCOME ? 1 : -1;
    const isCash = tx.payment_method === PaymentMethod.CASH;
    return {
      cash: isCash ? sign * amt : 0,
      card: isCash ? 0 : sign * amt,
      total: sign * amt,
    };
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
        throw new BadRequestException('Ochiq smena mavjud. Avval uni yoping!');
      }

      // Get main cashbox balance
      const mainCashbox = await this.cashboxRepo.findOne({
        where: { cashbox_type: Cashbox_type.MAIN },
      });

      if (!mainCashbox) {
        throw new NotFoundException('Main cashbox not found');
      }

      // Kassaning hozirgi haqiqiy balansini olish
      // balance_cash va balance_card har bir tranzaksiyada yangilanadi,
      // shuning uchun smenalar orasida bo'lgan tranzaksiyalar ham hisobga olinadi
      const openingCash = mainCashbox.balance_cash ?? 0;
      const openingCard = mainCashbox.balance_card ?? 0;

      // Create new shift
      const shift = this.shiftRepo.create({
        opened_by: user.id,
        opened_at: Date.now(),
        status: ShiftStatus.OPEN,
        opening_balance_cash: openingCash,
        opening_balance_card: openingCard,
      });

      await this.shiftRepo.save(shift);

      this.activityLog.log({
        entity_type: 'shift',
        entity_id: shift.id,
        action: 'opened',
        new_value: {
          opening_balance_cash: openingCash,
          opening_balance_card: openingCard,
        },
        description: `Smena ochildi — naqd: ${openingCash}, karta: ${openingCard}`,
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

      // Yopilish balanslari — JONLI kassadan olinadi (haqiqat manbai).
      // Kartalararo emas, balki KARTA↔NAQD konvertatsiyalari naqd/karta
      // ajratimini kirim/chiqimsiz o'zgartirishi mumkin; shu sababli tarixdan
      // qayta hisoblash (opening + income − expense) emas, jonli balansdan
      // olamiz — bu har doim to'g'ri va kelajakdagi yangi harakat turlariga
      // bog'lanib qolmaymiz.
      const closingBalanceCash = mainCashbox.balance_cash;
      const closingBalanceCard = mainCashbox.balance_card;

      // Rekonsiliatsiya: closing − (opening + income − expense) = sof konvertatsiya.
      // Operatorga "nega closing ≠ opening+kirim−chiqim" ni tushuntiradi.
      const netConversionCash =
        closingBalanceCash -
        (openShift.opening_balance_cash + totalIncomeCash - totalExpenseCash);
      const netConversionCard =
        closingBalanceCard -
        (openShift.opening_balance_card + totalIncomeCard - totalExpenseCard);

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
          // Sof karta↔naqd konvertatsiya (kirim/chiqimsiz ajratim siljishi)
          conversion: {
            cash: netConversionCash,
            card: netConversionCard,
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
        relations: ['createdByUser', 'sourceUser', 'order'],
      });

      // Virtual kartalar — "Kartalar bo'yicha joriy qoldiq" bo'limi uchun
      const cards = await this.cashboxCardRepo.find({
        where: { cashbox_id: mainCashbox.id, is_active: true },
        order: { is_default: 'DESC', sort_order: 'ASC', created_at: 'ASC' },
      });

      // Generate Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Smena hisoboti');

      // Build shift report
      this.buildShiftReportExcel(
        worksheet,
        shift,
        shiftHistories,
        cards,
        mainCashbox,
      );

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer as any;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Smena hisobotini quradi — asosiy kassa bilan AYNAN bir xil toza builder.
   * Barcha sonlar smena entity'sidan olinadi (closeShift JONLI balansdan aniq
   * hisoblab yozadi), shu sabab taxmin yo'q; Yopilish = Ochilish + Kirim −
   * Chiqim + Konvertatsiya doim mos keladi.
   */
  private buildShiftReportExcel(
    worksheet: ExcelJS.Worksheet,
    shift: ShiftEntity,
    histories: CashboxHistoryEntity[],
    cards: CashboxCardEntity[],
    mainCashbox: CashEntity,
  ) {
    const opening = {
      cash: shift.opening_balance_cash || 0,
      card: shift.opening_balance_card || 0,
      total:
        (shift.opening_balance_cash || 0) + (shift.opening_balance_card || 0),
    };
    const income = {
      cash: shift.total_income_cash || 0,
      card: shift.total_income_card || 0,
      total: (shift.total_income_cash || 0) + (shift.total_income_card || 0),
    };
    const expense = {
      cash: shift.total_expense_cash || 0,
      card: shift.total_expense_card || 0,
      total: (shift.total_expense_cash || 0) + (shift.total_expense_card || 0),
    };
    // Yopilish — yopilgan smenada entity'dan; hali ochiq bo'lsa
    // (closing 0) Ochilish + Kirim − Chiqim bilan baholanadi.
    const closed = shift.status === ShiftStatus.CLOSED;
    const closing = closed
      ? {
          cash: shift.closing_balance_cash || 0,
          card: shift.closing_balance_card || 0,
          total:
            (shift.closing_balance_cash || 0) +
            (shift.closing_balance_card || 0),
        }
      : {
          cash: opening.cash + income.cash - expense.cash,
          card: opening.card + income.card - expense.card,
          total: opening.total + income.total - expense.total,
        };
    const conversion = {
      cash: closing.cash - (opening.cash + income.cash - expense.cash),
      card: closing.card - (opening.card + income.card - expense.card),
    };

    const history = [...histories].sort(
      (a, b) => Number(a.created_at) - Number(b.created_at),
    );

    const openStr = this.formatUzDateTime(shift.opened_at);
    const closeStr = shift.closed_at
      ? this.formatUzDateTime(shift.closed_at)
      : 'davom etmoqda';
    const subtitle =
      `Ochildi: ${openStr} (${shift.openedByUser?.name || '—'})    |    ` +
      `Yopildi: ${closeStr} (${shift.closedByUser?.name || '—'})` +
      (shift.comment ? `    |    Izoh: ${shift.comment}` : '');

    this.buildMainCashboxSheet(worksheet, {
      title: 'SMENA HISOBOTI',
      subtitle,
      recon: { opening, income, expense, conversion, closing },
      cards: cards.map((c) => ({ name: c.name, balance: c.balance ?? 0 })),
      cardTotal: mainCashbox.balance_card ?? 0,
      history,
    });
  }

  /**
   * Get shift history (list of all shifts)
   */
  async getShiftHistory(query: {
    page?: number;
    limit?: number;
    fetchAll?: boolean;
  }) {
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
