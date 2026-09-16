import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import {
  Cashbox_type,
  ExtraCostDecisionMode,
  ExtraCostStatus,
  Order_status,
  Roles,
  Status,
} from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ExtraCostApplierService } from './extra-cost-applier.service';
import { ExtraCostRequestService } from './extra-cost-request.service';
import { ExtraCostTelegramService } from './extra-cost-telegram.service';

/**
 * QO'SHIMCHA XARAJAT — QAROR (tasdiqlash / rad etish).
 *
 * ⚠️ BU YERDA PUL HARAKAT QILADI. Ikki xavf boshqacha og'irlikda:
 *
 *   IKKI MARTA TO'LASH — market ikki brauzer oynasidan yoki ikki xodim bir
 *   vaqtda "Tasdiqlash" bossa, pul ikki marta yozilardi. Himoya: ATOMIK
 *   STATUS DARVOZASI (`UPDATE ... WHERE status='pending'`). `affected === 0`
 *   bo'lsa hech narsa yozilmaydi va 409 qaytadi. Ikkinchi devor —
 *   `UQ_ECR_MARKET_HIST` / `UQ_ECR_COURIER_HIST` partial-unique indekslari.
 *
 *   UMUMAN TO'LAMASLIK — so'rov "tasdiqlangan" bo'lib qoladi-yu kassa yozuvi
 *   yaratilmaydi. Himoya: hamma narsa BITTA tranzaksiyada; kassa topilmasa
 *   yoki UPDATE 0 qator qaytarsa, xato tashlanadi va butun tranzaksiya
 *   orqaga qaytadi.
 *
 * ⚠️ RAD ETISH HECH QANDAY KASSA YOZUVI YARATMAYDI. `CORRECTION + INCOME`
 * juftligi butun kod bazasida faqat `reverseExtraCostForCashbox` uchun band —
 * uni bu yerda ishlatish keyingi rollback'ni buzardi.
 */
@Injectable()
export class ExtraCostDecisionService {
  private readonly logger = new Logger(ExtraCostDecisionService.name);

  constructor(
    @InjectRepository(ExtraCostRequestEntity)
    private readonly requestRepo: Repository<ExtraCostRequestEntity>,
    private readonly dataSource: DataSource,
    private readonly applier: ExtraCostApplierService,
    private readonly activityLog: ActivityLogService,
    private readonly requests: ExtraCostRequestService,
    private readonly telegram: ExtraCostTelegramService,
  ) {}

  // ═══════════════════════ TASDIQLASH ═══════════════════════

  async approve(
    requestId: string,
    user: JwtPayload,
    opts: { adminOverride?: boolean; autoBackstop?: boolean } = {},
  ): Promise<ExtraCostRequestEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ── 1. ATOMIK DARVOZA ─────────────────────────────────────────────
      //
      // Status o'zgarishi BIRINCHI amal. Bu ikki marta tasdiqlashning
      // yagona ishonchli to'sig'i: DB darajasida faqat bitta so'rov
      // `pending` dan `approved` ga o'ta oladi.
      const now = Date.now();
      const gate = queryRunner.manager
        .createQueryBuilder()
        .update(ExtraCostRequestEntity)
        .set({
          status: ExtraCostStatus.APPROVED,
          reviewed_by: user.id,
          reviewed_at: now,
          // ⚠️ AUDIT IZI ANIQ BO'LISHI SHART. Zaxira tasdiq (14 kun
          // javobsizlik) market qarori kabi ko'rinmasligi kerak — aks holda
          // nizoda "market tasdiqlagan" deb ko'rsatilardi, holbuki market
          // umuman javob bermagan.
          decision_mode: opts.autoBackstop
            ? ExtraCostDecisionMode.AUTO_BACKSTOP
            : opts.adminOverride
              ? ExtraCostDecisionMode.ADMIN_OVERRIDE
              : ExtraCostDecisionMode.MARKET,
          ...(opts.autoBackstop
            ? {
                review_note:
                  'Market 14 kun javob bermadi — avtomatik tasdiqlandi',
              }
            : {}),
          updated_at: now,
        })
        .where('id = :id', { id: requestId })
        .andWhere('status = :pending', { pending: ExtraCostStatus.PENDING });

      // Admin arbitraji va zaxira tasdiqdan tashqari — FAQAT o'z marketining
      // so'rovi.
      if (!opts.adminOverride && !opts.autoBackstop) {
        gate.andWhere('market_id = :marketId', { marketId: user.id });
      }

      const gateResult = await gate.execute();
      if (!gateResult.affected) {
        await queryRunner.rollbackTransaction();
        throw new ConflictException(
          "So'rov allaqachon ko'rib chiqilgan yoki sizga tegishli emas",
        );
      }

      const req = await queryRunner.manager.findOne(ExtraCostRequestEntity, {
        where: { id: requestId },
      });
      if (!req) {
        await queryRunner.rollbackTransaction();
        throw new NotFoundException("So'rov topilmadi");
      }

      // ── 2. BUYURTMA HOLATI ────────────────────────────────────────────
      //
      // `void` allaqachon to'sishi kerak edi (rollback uni bekor qiladi) —
      // bu ikkinchi devor.
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: req.order_id },
      });
      if (!order) {
        await queryRunner.rollbackTransaction();
        throw new NotFoundException('Buyurtma topilmadi');
      }
      const settledStatuses: Order_status[] = [
        Order_status.SOLD,
        Order_status.PAID,
        Order_status.PARTLY_PAID,
        Order_status.CANCELLED,
        Order_status.CLOSED,
      ];
      if (!settledStatuses.includes(order.status)) {
        await queryRunner.rollbackTransaction();
        throw new ConflictException(
          `Buyurtma holati o'zgargan (${order.status}) — xarajat tasdiqlab bo'lmaydi`,
        );
      }

      // ── 3. CHEGARA — SNAPSHOT bo'yicha, jonli tarifdan EMAS ───────────
      //
      // Kuryer tarifi so'rov bilan qaror orasida o'zgarsa, allaqachon
      // qonuniy bo'lgan so'rov to'satdan "chegaradan oshgan" bo'lib
      // qolmasligi kerak.
      if (req.limit_max > 0 && req.amount > req.limit_max) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException(
          `So'ralgan summa ruxsat etilgan chegaradan oshgan ` +
            `(${req.amount.toLocaleString('uz-UZ')} > ${req.limit_max.toLocaleString('uz-UZ')})`,
        );
      }

      // ── 4. KURYER HOLATI ──────────────────────────────────────────────
      //
      // ⚠️ Tizimda kuryerga PUL BERISH endpointi umuman yo'q — to'lov
      // kuryerning kassa qarzini kamaytirish orqali bo'ladi. O'chirilgan
      // kuryer kassasiga yozilgan pul esa hech qachon hech kimga
      // berilmaydi, ya'ni u jimgina yo'qoladi. Shuning uchun bunday holat
      // admin qaroriga chiqariladi.
      const courier = await queryRunner.manager.findOne(UserEntity, {
        where: { id: req.courier_id },
      });
      if (!courier || courier.is_deleted || courier.status !== Status.ACTIVE) {
        // ⚠️ ROLLBACK OLDIN, ESKALATSIYA KEYIN.
        //
        // `escalate()` ALOHIDA ulanishda ishlaydi (`requestRepo`), bu
        // tranzaksiya esa atomik darvoza tufayli AYNI qatorni lock'lab
        // turibdi. Eskalatsiya avval chaqirilsa, u o'zining qulfini kutib
        // abadiy osiladi va pool'dan ulanish oqib ketadi.
        await queryRunner.rollbackTransaction();
        await this.escalate(
          requestId,
          'Kuryer faol emas — tasdiqlash uchun admin qarori kerak',
        );
        throw new ConflictException(
          "Kuryer faol emas. So'rov admin ko'rigiga yuborildi.",
        );
      }

      // ── 5. IKKALA KASSA MAJBURIY ──────────────────────────────────────
      const [marketCashbox, courierCashbox] = await Promise.all([
        queryRunner.manager.findOne(CashEntity, {
          where: {
            cashbox_type: Cashbox_type.FOR_MARKET,
            user_id: req.market_id,
          },
        }),
        queryRunner.manager.findOne(CashEntity, {
          where: {
            cashbox_type: Cashbox_type.FOR_COURIER,
            user_id: req.courier_id,
          },
        }),
      ]);
      if (!marketCashbox || !courierCashbox) {
        // Rollback oldin — yuqoridagi bilan bir xil sabab (qulf).
        await queryRunner.rollbackTransaction();
        await this.escalate(requestId, 'Kassa topilmadi — admin qarori kerak');
        throw new ConflictException(
          "Kassa topilmadi. So'rov admin ko'rigiga yuborildi.",
        );
      }

      // ── 6-7. PUL + TARIX (atomik) ─────────────────────────────────────
      const historyIds = await this.applier.applyAtomic(queryRunner, {
        marketCashboxId: marketCashbox.id,
        courierCashboxId: courierCashbox.id,
        orderId: req.order_id,
        amount: req.amount,
        comment:
          `Qo'shimcha xarajat tasdiqlandi — buyurtma #${req.order_number}` +
          (req.reason ? ` (${req.reason})` : ''),
        createdBy: user.id,
        marketId: req.market_id,
        courierId: req.courier_id,
        // Kassa yozuvi BUGUN tug'iladi, lekin u o'sha kungi buyurtmaga
        // tegishli ekani ko'rinib tursin.
        paymentDate: req.order_action_at,
      });

      // ── 8. LANGARLAR ──────────────────────────────────────────────────
      req.settled_at = now;
      req.market_history_id = historyIds.marketHistoryId;
      req.courier_history_id = historyIds.courierHistoryId;
      await queryRunner.manager.save(ExtraCostRequestEntity, req);

      // ── 9. financial_balance_history ga YOZILMAYDI ────────────────────
      // Ta'sir NOL: `(−X) − (−X) = 0`. Yozilsa tarozi soxta siljirdi.

      await queryRunner.commitTransaction();

      this.activityLog.log({
        entity_type: 'order',
        entity_id: req.order_id,
        action: 'extra_cost_approved',
        new_value: {
          order_number: req.order_number,
          extra_cost: req.amount,
          category: req.category,
          extra_cost_request_id: req.id,
          decision_mode: req.decision_mode,
          proof_count: (req.proof_ids ?? []).length,
        },
        description:
          `Buyurtma #${req.order_number} — qo'shimcha xarajat tasdiqlandi: ` +
          `${req.amount.toLocaleString('uz-UZ')} so'm`,
        user,
      });

      // ⚠️ `await`SIZ va TRANZAKSIYADAN KEYIN. Kuryerga xabar yetmagani
      // tasdiqlangan pulni orqaga qaytarmasligi kerak.
      void this.telegram.notifyCourier(req, true);

      return req;
    } catch (e) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════ RAD ETISH ═══════════════════════

  async reject(
    requestId: string,
    user: JwtPayload,
    note: string,
    opts: { adminOverride?: boolean } = {},
  ): Promise<ExtraCostRequestEntity> {
    const reason = (note ?? '').trim();
    if (reason.length < 3) {
      // Kuryer nega rad etilganini BILISHI kerak — aks holda u xuddi shu
      // xatoni takrorlaydi va nizo hal bo'lmaydi.
      throw new BadRequestException(
        'Rad etish sababini yozing (kamida 3 belgi)',
      );
    }

    const now = Date.now();
    const gate = this.requestRepo
      .createQueryBuilder()
      .update(ExtraCostRequestEntity)
      .set({
        status: ExtraCostStatus.REJECTED,
        reviewed_by: user.id,
        reviewed_at: now,
        review_note: reason,
        decision_mode: opts.adminOverride
          ? ExtraCostDecisionMode.ADMIN_OVERRIDE
          : ExtraCostDecisionMode.MARKET,
        updated_at: now,
      })
      .where('id = :id', { id: requestId })
      .andWhere('status IN (:...open)', {
        open: [ExtraCostStatus.PENDING, ExtraCostStatus.AWAITING_PROOF],
      });

    if (!opts.adminOverride) {
      gate.andWhere('market_id = :marketId', { marketId: user.id });
    }

    const res = await gate.execute();
    if (!res.affected) {
      throw new ConflictException(
        "So'rov allaqachon ko'rib chiqilgan yoki sizga tegishli emas",
      );
    }

    const req = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException("So'rov topilmadi");

    // ⚠️ KASSAGA HECH NARSA YOZILMAYDI. Pul hech qachon harakat qilmagan —
    // qaytariladigan narsa yo'q.
    this.activityLog.log({
      entity_type: 'order',
      entity_id: req.order_id,
      action: 'extra_cost_rejected',
      new_value: {
        order_number: req.order_number,
        extra_cost: req.amount,
        extra_cost_request_id: req.id,
        review_note: reason,
      },
      description:
        `Buyurtma #${req.order_number} — qo'shimcha xarajat rad etildi: ` +
        `${req.amount.toLocaleString('uz-UZ')} so'm (${reason})`,
      user,
    });

    void this.telegram.notifyCourier(req, false);

    return req;
  }

  // ═══════════════════════ KO'P SO'ROVNI TASDIQLASH ═══════════════════════

  /**
   * ⚠️ KETMA-KET, parallel EMAS.
   *
   * Har bir so'rov o'z tranzaksiyasi va o'z atomik darvozasiga ega. Parallel
   * bajarilsa bitta kassa qatori ustida bir nechta tranzaksiya to'planib,
   * lock kutish va deadlock xavfi paydo bo'lardi. Market 30 ta kartani
   * bittalab bosishi realistik emas, shuning uchun bu qulaylik kerak —
   * lekin tezlik uchun xavfsizlikni almashtirmaymiz.
   */
  async bulkApprove(
    ids: string[],
    user: JwtPayload,
  ): Promise<{
    approved: number;
    skipped: Array<{ id: string; reason: string }>;
  }> {
    if (!ids?.length) throw new BadRequestException("So'rov tanlanmagan");
    if (ids.length > 50) {
      throw new BadRequestException(
        "Bir vaqtda eng ko'pi 50 ta so'rovni tasdiqlash mumkin",
      );
    }

    let approved = 0;
    const skipped: Array<{ id: string; reason: string }> = [];
    for (const id of [...new Set(ids)]) {
      try {
        await this.approve(id, user);
        approved++;
      } catch (e) {
        skipped.push({
          id,
          reason: e instanceof Error ? e.message : "Noma'lum xato",
        });
      }
    }
    return { approved, skipped };
  }

  // ═══════════════════════ QAYTA YUBORISH — v1 DA YO'Q ═══════════════════════
  //
  // Rad etilgan so'rovni kuryer yangi isbot bilan qayta yuborishi rejada bor
  // (`resubmit_of` ustuni va zanjir cheklovi allaqachon sxemada), lekin v1 ga
  // KIRITILMADI: u yangi so'rov yaratishni, eski bilan bog'lashni va market
  // sahifasida zanjirni ko'rsatishni talab qiladi.
  //
  // v1 da rad etilgan xarajat ADMIN ARBITRAJI orqali hal qilinadi
  // (`approve(..., { adminOverride: true })`) — bu ham yozma iz qoldiradi va
  // kuryerni javobsiz qoldirmaydi.

  // ═══════════════════════ ISBOT BIRIKTIRISH ═══════════════════════

  /**
   * Kuryer `awaiting_proof` so'roviga keyinchalik isbot biriktiradi.
   *
   * Tranzaksiya SHU YERDA ochiladi (so'rov servisi uni parametr sifatida
   * oladi) — status o'zgarishi va isbot bog'lanishi bo'linmas bo'lishi shart.
   *
   * Muvaffaqiyatdan keyin marketga xabar ketadi: endi so'rov haqiqatan ham
   * tasdiq kutmoqda.
   */
  async attachProof(
    requestId: string,
    user: JwtPayload,
    proofIds: string[],
  ): Promise<ExtraCostRequestEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const req = await this.requests.attachProof(queryRunner, {
        requestId,
        courierId: user.id,
        proofIds,
      });
      await queryRunner.commitTransaction();

      // Endi so'rov PENDING — marketga xabar berish o'rinli.
      this.requests.notifyMarketAboutRequest(req);

      this.activityLog.log({
        entity_type: 'order',
        entity_id: req.order_id,
        action: 'extra_cost_proof_attached',
        new_value: {
          order_number: req.order_number,
          extra_cost_request_id: req.id,
          proof_count: (req.proof_ids ?? []).length,
        },
        description:
          `Buyurtma #${req.order_number} — qo'shimcha xarajatga isbot ` +
          `biriktirildi (${(req.proof_ids ?? []).length} ta)`,
        user,
      });

      return req;
    } catch (e) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════ ESKALATSIYA ═══════════════════════

  /**
   * So'rovni admin navbatiga chiqaradi. STATUS O'ZGARMAYDI — faqat
   * `escalated_at` qo'yiladi, ya'ni pul harakat qilmaydi.
   *
   * ⚠️ ALOHIDA ULANISHDA ishlaydi: chaqiruvchining tranzaksiyasi rollback
   * bo'lishi kutilmoqda (masalan kuryer faol emas), lekin eskalatsiya
   * belgisi SAQLANISHI kerak — aks holda hech kim bu holatni ko'rmaydi.
   */
  private async escalate(requestId: string, reason: string): Promise<void> {
    try {
      // ⚠️ `review_note` GA TEGILMAYDI. U kuryer ko'radigan maydon —
      // market rad etish sababini yozsa, eskalatsiya uni o'chirib yuborardi.
      // Eskalatsiya sababi log'da qoladi.
      await this.requestRepo.update(
        { id: requestId },
        { escalated_at: Date.now() },
      );
      this.logger.warn(`Eskalatsiya (${requestId}): ${reason}`);
    } catch (e) {
      this.logger.error(
        `Eskalatsiya yozilmadi (${requestId}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // ═══════════════════════ RO'YXATLAR ═══════════════════════

  /** MARKET o'z so'rovlarini ko'radi — `market_id` TOKENDAN olinadi. */
  async listForMarket(
    user: JwtPayload,
    filters: {
      status?: ExtraCostStatus;
      escalated?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const qb = this.requestRepo
      .createQueryBuilder('r')
      // ⚠️ Egalik SO'ROV ICHIDA — parametr sifatida emas. `:marketId` param
      // bo'lsa ham u tokendan keladi, ya'ni foydalanuvchi uni almashtira
      // olmaydi (`GET order/market/:id` dagi mavjud IDOR takrorlanmaydi).
      .where('r.market_id = :marketId', { marketId: user.id })
      // ⚠️ `awaiting_proof` MARKETGA KO'RINMAYDI.
      //
      // Bu holatdagi so'rov hali YUBORILMAGAN: kuryer "isbotsiz davom
      // etish"ni tanlagan va rasmni keyin biriktiradi. Market uni ko'rsa,
      // "Tasdiqlash" tugmasini bosib 409 olardi (tasdiqlash darvozasi faqat
      // `pending` ni qabul qiladi) — ya'ni ishlamaydigan tugma.
      .andWhere('r.status != :hidden', {
        hidden: ExtraCostStatus.AWAITING_PROOF,
      })
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) {
      qb.andWhere('r.status = :status', { status: filters.status });
    }
    // "Muddati o'tgan" — javob berilmagani uchun admin arbitrajiga chiqqan
    // so'rovlar. Market ularni ALOHIDA ko'rishi kerak, chunki javob
    // bermaslik endi pulni o'z-o'zidan tasdiqlanishiga olib keladi.
    if (filters.escalated) {
      qb.andWhere('r.escalated_at IS NOT NULL');
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  /** KURYER o'z so'rovlarini ko'radi. */
  async listForCourier(
    user: JwtPayload,
    filters: { status?: ExtraCostStatus; page?: number; limit?: number },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const qb = this.requestRepo
      .createQueryBuilder('r')
      .where('r.courier_id = :courierId', { courierId: user.id })
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) {
      qb.andWhere('r.status = :status', { status: filters.status });
    }

    const [items, total] = await qb.getManyAndCount();

    // ⚠️ IKKI XIL JAMI — ATAYLAB AJRATILGAN.
    //
    // Avval bitta "tasdiq kutilmoqda" summasi bor edi va u `awaiting_proof`
    // ni ham qo'shib hisoblardi. Natijada kuryer marketga UMUMAN
    // yuborilmagan pulni "market tasdiqlashini kutmoqda" deb ko'rardi.
    // Ikkisi butunlay boshqa holat:
    //
    //   `pending_total`  — marketdan javob kutilmoqda (mendan ish yo'q)
    //   `awaiting_total` — MENDAN isbot kutilmoqda (biriktirmasam yo'qoladi)
    const sums = await this.requestRepo
      .createQueryBuilder('r')
      .select(
        "COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'pending'), 0)",
        'pending',
      )
      .addSelect(
        "COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'awaiting_proof'), 0)",
        'awaiting',
      )
      .where('r.courier_id = :courierId', { courierId: user.id })
      .getRawOne<{ pending: string; awaiting: string }>();

    return {
      items,
      total,
      page,
      limit,
      pending_total: Number(sums?.pending ?? 0),
      awaiting_total: Number(sums?.awaiting ?? 0),

      /**
       * ⚠️ SERVER VAQTI — teskari sanoq uchun.
       *
       * Kuryer ekranida "isbot biriktirishga qancha qoldi" sanog'i turadi.
       * U `created_at + 24 soat` ga qarab hisoblanadi, solishtiruv esa
       * TELEFON soati bilan bo'lardi. Arzon Android telefonlarda soat
       * bir necha soatga adashishi odatiy hol — natijada kuryer "6 soat
       * bor" deb ko'rib turganda so'rov allaqachon bekor bo'lgan bo'lardi
       * (yoki aksincha, bekorga shoshilardi).
       *
       * Klient shu qiymat bilan o'z soatining OG'ISHINI hisoblab, sanoqni
       * server vaqtiga moslaydi. Muddatni kim belgilasa (CRON — server),
       * sanoq ham o'shanning vaqtida yurishi kerak.
       */
      server_now: Date.now(),
    };
  }

  /**
   * MARKET BADGE'I — yon menyudagi qizil raqam.
   *
   * ⚠️ FAQAT `pending` sanaladi. Avval `awaiting_proof` ham qo'shilardi va
   * market badge'da "3" ko'rib sahifani ochganda BO'SH ro'yxat topardi —
   * chunki isbotsiz so'rovlar unga ko'rsatilmaydi. Badge ko'rinadigan ish
   * bilan bir xil raqamni ko'rsatishi shart.
   */
  async countOpenForMarket(user: JwtPayload): Promise<{
    open: number;
    escalated: number;
    amount: number;
  }> {
    const raw = await this.requestRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'open')
      .addSelect(
        'COUNT(*) FILTER (WHERE r.escalated_at IS NOT NULL)',
        'escalated',
      )
      .addSelect('COALESCE(SUM(r.amount), 0)', 'amount')
      .where('r.market_id = :marketId', { marketId: user.id })
      .andWhere('r.status = :pending', { pending: ExtraCostStatus.PENDING })
      .getRawOne<{ open: string; escalated: string; amount: string }>();

    return {
      open: Number(raw?.open ?? 0),
      escalated: Number(raw?.escalated ?? 0),
      amount: Number(raw?.amount ?? 0),
    };
  }

  /**
   * KURYER BADGE'I.
   *
   * Ikki xil raqam, chunki ular ikki xil ish:
   *
   *   `unseen`         — qaror chiqqan, kuryer hali ko'rmagan (o'qilsa yo'qoladi)
   *   `awaiting_proof` — ISH TALAB QILADI: isbot biriktirmasa, muddati o'tib
   *                      so'rov bekor bo'ladi va pul yo'qoladi
   *
   * Badge `awaiting_proof` ni birinchi ko'rsatadi: ko'rilmagan qaror
   * shunchaki xabar, isbot biriktirmaslik esa PUL YO'QOTISH.
   */
  async countUnseenForCourier(user: JwtPayload): Promise<{
    unseen: number;
    awaiting_proof: number;
    pending: number;
  }> {
    const raw = await this.requestRepo
      .createQueryBuilder('r')
      .select(
        "COUNT(*) FILTER (WHERE r.status IN ('approved','rejected','void') " +
          'AND r.seen_by_courier_at IS NULL)',
        'unseen',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE r.status = 'awaiting_proof')",
        'awaiting_proof',
      )
      .addSelect("COUNT(*) FILTER (WHERE r.status = 'pending')", 'pending')
      .where('r.courier_id = :courierId', { courierId: user.id })
      .getRawOne<{ unseen: string; awaiting_proof: string; pending: string }>();

    return {
      unseen: Number(raw?.unseen ?? 0),
      awaiting_proof: Number(raw?.awaiting_proof ?? 0),
      pending: Number(raw?.pending ?? 0),
    };
  }

  /** Kuryer qarorlarni ko'rdi — banner yopiladi. */
  async markSeenByCourier(user: JwtPayload): Promise<number> {
    const res = await this.requestRepo
      .createQueryBuilder()
      .update(ExtraCostRequestEntity)
      .set({ seen_by_courier_at: Date.now() })
      .where('courier_id = :courierId', { courierId: user.id })
      .andWhere('seen_by_courier_at IS NULL')
      .andWhere('status IN (:...decided)', {
        decided: [
          ExtraCostStatus.APPROVED,
          ExtraCostStatus.REJECTED,
          ExtraCostStatus.VOID,
        ],
      })
      .execute();
    return res.affected ?? 0;
  }

  /** ADMIN arbitraj navbati — muddati o'tganlar birinchi. */
  async listForAdmin(
    user: JwtPayload,
    filters: {
      status?: ExtraCostStatus;
      escalated?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    // `JwtPayload.role` — `string` (tokendan), `Roles` esa enum. Niyatni
    // aniq bildiramiz: `RolesGuard` allaqachon rolni tekshirgan.
    const role = user.role as Roles;
    if (role !== Roles.ADMIN && role !== Roles.SUPERADMIN) {
      throw new ForbiddenException("Ruxsat yo'q");
    }
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const qb = this.requestRepo
      .createQueryBuilder('r')
      .orderBy('r.escalated_at', 'ASC', 'NULLS LAST')
      .addOrderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) {
      qb.andWhere('r.status = :status', { status: filters.status });
    }
    if (filters.escalated) {
      qb.andWhere('r.escalated_at IS NOT NULL');
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }
}
