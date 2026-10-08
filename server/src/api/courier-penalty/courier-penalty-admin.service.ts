import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { CourierPenaltyConfigEntity } from 'src/core/entity/courier-penalty-config.entity';
import { CourierPenaltyRuleEntity } from 'src/core/entity/courier-penalty-rule.entity';
import { CourierPenaltyEntryEntity } from 'src/core/entity/courier-penalty-entry.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { Order_status, Roles } from 'src/common/enums';
import {
  computeCourierAdjustment,
  CourierPenaltyEvent,
  CourierPenaltyScope,
  deadlineStateOf,
  pickRule,
  type PenaltyRule,
} from '../order/utils/courier-penalty.util';
import { CourierPenaltyService } from './courier-penalty.service';
import { WAIVER_REASONS, type WaiverReason } from './waiver-reasons.const';

/**
 * SHTRAF MODULI — ADMIN TOMONI.
 *
 * ⚠️ NEGA ALOHIDA SERVIS. `CourierPenaltyService` SOTUV yo'lida, pul
 * tranzaksiyasi ichida ishlaydi — u yengil va tez bo'lishi shart. Admin
 * so'rovlari esa og'ir (butun kuryerlar bo'yicha skan, sahifalash,
 * jamlash). Ularni bir sinfga qo'yish birinchi navbatda o'qishni
 * qiyinlashtirardi, ikkinchidan og'ir so'rovni tasodifan sotuv yo'lidan
 * chaqirib qo'yish xavfini tug'dirardi.
 */
@Injectable()
export class CourierPenaltyAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly core: CourierPenaltyService,
  ) {}

  private get manager(): EntityManager {
    return this.dataSource.manager;
  }

  // ══════════════════ KECHIKKANLAR RO'YXATI ══════════════════

  /**
   * HAL QILINMAGAN, MUDDATI O'TGAN BUYURTMALAR — kuryer bo'yicha.
   *
   * ⚠️ MODULNING ENG MUHIM EKRANI. Shtraf faqat kuryer tugmani BOSGANDA
   * yoziladi, asosiy muammo esa UMUMAN BOSMASLIK: hech qachon bosmagan
   * kuryer hech narsa to'lamaydi. Ya'ni bu ro'yxat qulaylik emas —
   * modulning ishlashi uchun ZARUR qism. Usiz shtraf eng intizomli
   * kuryerni jazolab, eng beparvosini tegmay qo'yardi.
   *
   * Hisob `computeCourierAdjustment` dan — ro'yxatdagi son kuryer
   * ekranidagi son bilan AYNI bo'lishi shart.
   */
  async overdue(
    query: {
      courierId?: string;
      regionId?: string;
      minDays?: number;
      page?: number;
      limit?: number;
    },
    /**
     * ⚠️ Vaqt PARAMETR. `Date.now()` ichkarida qotirilsa bu metodni
     * sinab bo'lmasdi — kechikish hisobining butun mantig'i aynan
     * vaqtga bog'liq, ya'ni eng muhim qism testsiz qolardi.
     */
    now = Date.now(),
  ) {
    const [config, rules] = await Promise.all([
      this.core.loadConfig(this.manager),
      this.core.loadRules(this.manager),
    ]);
    const activatedAt = config?.activated_at ?? config?.shadow_since ?? null;

    const qb = this.manager
      .createQueryBuilder()
      .select([
        'o.id AS id',
        'o.order_number AS order_number',
        'o.courier_tariff AS courier_tariff',
        'o.where_deliver AS where_deliver',
        'o.total_price AS total_price',
        'p.created_at AS post_created_at',
        'p.region_id AS post_region_id',
        'c.id AS courier_id',
        'c.name AS courier_name',
        'c.phone_number AS courier_phone',
        'c.region_id AS courier_region_id',
        'c.tariff_center AS tariff_center',
        'c.tariff_home AS tariff_home',
        'c.penalty_exempt AS penalty_exempt',
        'm.name AS market_name',
      ])
      .from(OrderEntity, 'o')
      .innerJoin(PostEntity, 'p', 'p.id = o.post_id')
      .innerJoin(UserEntity, 'c', 'c.id = p.courier_id')
      .leftJoin(UserEntity, 'm', 'm.id = o.user_id')
      .where('o.status = :st', { st: Order_status.WAITING })
      .andWhere('o.deleted_at IS NULL')
      /**
       * ⚠️ Tashqi provayder kuryerlari (Elchi/LDG virtual vakillari)
       * SQL darajasida chiqarib tashlanadi. Ular hech qachon shtrafga
       * tushmaydi, ro'yxatda turishi esa adminni chalg'itardi.
       */
      .andWhere('c.external_provider IS NULL');

    if (query.courierId)
      qb.andWhere('c.id = :cid', { cid: query.courierId });
    if (query.regionId)
      qb.andWhere('COALESCE(p.region_id, c.region_id) = :rid', {
        rid: query.regionId,
      });

    const rows: Array<Record<string, any>> = await qb
      .orderBy('p.created_at', 'ASC')
      .getRawMany();

    const minDays = Math.max(0, Number(query.minDays ?? 1));
    const byCourier = new Map<string, any>();

    for (const r of rows) {
      if (r.penalty_exempt) continue;

      const dispatchedAt = Number(r.post_created_at);
      const regionId = r.post_region_id ?? r.courier_region_id ?? null;
      const rule = pickRule(
        rules,
        CourierPenaltyEvent.LATE_MARK,
        now,
        r.courier_id,
        regionId,
      );
      const state = deadlineStateOf(
        dispatchedAt,
        now,
        rule?.threshold_days ?? 0,
      );
      if (!rule || !state || state.lateDays < minDays) continue;

      const baseTariff =
        r.courier_tariff != null
          ? Number(r.courier_tariff)
          : Number(
              (r.where_deliver === 'center'
                ? r.tariff_center
                : r.tariff_home) ?? 0,
            );

      const calc = computeCourierAdjustment({
        dispatchedAt,
        markedAt: now,
        baseTariff,
        courierId: r.courier_id,
        regionId,
        rules,
        activatedAt,
      });

      const immune = calc.skipReason === 'before_activation';

      let bucket = byCourier.get(r.courier_id);
      if (!bucket) {
        bucket = {
          courier_id: r.courier_id,
          courier_name: r.courier_name,
          courier_phone: r.courier_phone,
          overdue_count: 0,
          oldest_late_days: 0,
          penalty_now: 0,
          orders: [] as any[],
        };
        byCourier.set(r.courier_id, bucket);
      }

      bucket.overdue_count += 1;
      bucket.oldest_late_days = Math.max(
        bucket.oldest_late_days,
        state.lateDays,
      );
      bucket.penalty_now += calc.amount;
      bucket.orders.push({
        id: r.id,
        order_number: r.order_number == null ? null : Number(r.order_number),
        market_name: r.market_name,
        total_price: Number(r.total_price ?? 0),
        dispatched_at: dispatchedAt,
        deadline_at: state.penaltyStartsAt,
        late_days: state.lateDays,
        penalty_now: calc.amount,
        base_tariff: baseTariff,
        capped: calc.cappedByTariff,
        immune,
      });
    }

    /**
     * Eng og'ir kuryer birinchi o'rinda: avval eng uzoq kechikish, keyin
     * buyurtma soni. Admin ro'yxatni yuqoridan pastga ishlaydi, shuning
     * uchun tartib «kimga birinchi qo'ng'iroq qilish kerak» degan savolga
     * javob berishi kerak.
     */
    const couriers = [...byCourier.values()].sort(
      (a, b) =>
        b.oldest_late_days - a.oldest_late_days ||
        b.overdue_count - a.overdue_count,
    );
    for (const c of couriers) c.orders.sort((a: any, b: any) => b.late_days - a.late_days);

    return {
      module: { active: !!config?.is_active },
      summary: {
        couriers: couriers.length,
        orders: couriers.reduce((a, c) => a + c.overdue_count, 0),
        penalty_now: couriers.reduce((a, c) => a + c.penalty_now, 0),
      },
      couriers,
    };
  }

  // ══════════════════ DAFTAR VA SOYA YIG'INDISI ══════════════════

  /**
   * Yozilgan tuzatishlar ro'yxati.
   *
   * ⚠️ Kuryer va buyurtma nomlari IKKINCHI so'rov bilan olinadi, JOIN
   * bilan emas. Sabab: daftar sahifalanadi (`skip`/`take`), ko'p-tomonli
   * JOIN esa sahifalashni buzadi — loyihada bu nuqson allaqachon bir
   * marta ushlangan.
   */
  async entries(query: {
    courierId?: string;
    kind?: string;
    from?: number;
    to?: number;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));

    const qb = this.manager
      .createQueryBuilder(CourierPenaltyEntryEntity, 'e')
      .orderBy('e.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.courierId)
      qb.andWhere('e.courier_id = :cid', { cid: query.courierId });
    if (query.kind) qb.andWhere('e.kind = :k', { k: query.kind });
    if (query.from) qb.andWhere('e.created_at >= :f', { f: Number(query.from) });
    if (query.to) qb.andWhere('e.created_at <= :t', { t: Number(query.to) });

    const [rows, total] = await qb.getManyAndCount();

    const courierIds = [...new Set(rows.map((r) => r.courier_id))];
    const orderIds = [...new Set(rows.map((r) => r.order_id))];

    /**
     * ⚠️ ALLAQACHON BEKOR QILINGANLAR — alohida so'rov bilan.
     *
     * Sahifadagi `waiver` qatorlaridan aniqlash mumkin edi, lekin daftar
     * SAHIFALANADI: shtraf bir sahifada, uni bekor qilgan qator esa
     * boshqasida bo'lishi mumkin. U holda ekran bekor qilingan shtrafga
     * yana «bekor qilish» tugmasini ko'rsatib, admin bosganda server
     * xato qaytarardi — ya'ni ishlamaydigan tugma.
     */
    const waivedIds = rows.length
      ? new Set(
          (
            await this.manager.find(CourierPenaltyEntryEntity, {
              where: { waives_entry_id: In(rows.map((r) => r.id)) },
              select: ['waives_entry_id'],
            })
          )
            .map((w) => w.waives_entry_id)
            .filter((v): v is string => !!v),
        )
      : new Set<string>();

    const [couriers, orders] = await Promise.all([
      courierIds.length
        ? this.manager.find(UserEntity, {
            where: { id: In(courierIds) },
            select: ['id', 'name', 'phone_number'],
          })
        : [],
      orderIds.length
        ? this.manager.find(OrderEntity, {
            where: { id: In(orderIds) },
            select: ['id', 'order_number'],
          })
        : [],
    ]);
    const courierMap = new Map(couriers.map((c) => [c.id, c] as const));
    const orderMap = new Map(orders.map((o) => [o.id, o] as const));

    return {
      total,
      page,
      limit,
      items: rows.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        order_id: r.order_id,
        order_number: orderMap.get(r.order_id)?.order_number ?? null,
        courier_id: r.courier_id,
        courier_name: courierMap.get(r.courier_id)?.name ?? null,
        kind: r.kind,
        reason: r.reason,
        amount: Number(r.amount),
        late_days: r.late_days,
        base_tariff: r.base_tariff == null ? null : Number(r.base_tariff),
        shadow: r.shadow,
        waives_entry_id: r.waives_entry_id,
        /** Shu yozuv ustiga bekor qilish qatori yozilganmi. */
        waived: waivedIds.has(r.id),
        note: r.note,
      })),
    };
  }

  /**
   * SOYA YIG'INDISI — «agar yoqilganda qancha bo'lardi».
   *
   * ⚠️ YOQISH QARORINI AYNAN SHU RAQAMLAR HAL QILADI. Shuning uchun
   * «nolga tushgan» (tarif chegarasiga urilgan) yozuvlar alohida
   * sanaladi: ko'pchilik polni ursa, demak bitta tekis qoida yetarli
   * emas va kechikish DARAJALARI kerak.
   */
  async summary(query: { from?: number; to?: number }) {
    const params: any[] = [];
    const where: string[] = [];
    if (query.from) {
      params.push(Number(query.from));
      where.push(`"created_at" >= $${params.length}`);
    }
    if (query.to) {
      params.push(Number(query.to));
      where.push(`"created_at" <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [totals] = await this.manager.query(
      `
      SELECT
        count(*) FILTER (WHERE "kind" = 'penalty')               AS penalty_count,
        COALESCE(sum("amount") FILTER (WHERE "kind" = 'penalty'), 0) AS penalty_sum,
        count(*) FILTER (WHERE "kind" = 'bonus')                 AS bonus_count,
        COALESCE(sum(-"amount") FILTER (WHERE "kind" = 'bonus'), 0)  AS bonus_sum,
        count(*) FILTER (WHERE "kind" = 'waiver')                AS waiver_count,
        COALESCE(sum(-"amount") FILTER (WHERE "kind" = 'waiver'), 0) AS waiver_sum,
        count(DISTINCT "courier_id")                             AS couriers,
        count(*) FILTER (WHERE "shadow" = true)                  AS shadow_count,
        -- Tarif chegarasiga urilgan: shtraf AYNAN tarifga teng chiqqan
        count(*) FILTER (
          WHERE "kind" = 'penalty' AND "base_tariff" IS NOT NULL
            AND "amount" = "base_tariff"
        ) AS capped_count
      FROM "courier_penalty_entry"
      ${whereSql}
      `,
      params,
    );

    const config = await this.core.loadConfig(this.manager);
    const num = (v: unknown) => Number(v ?? 0);

    return {
      module: {
        active: !!config?.is_active,
        activated_at: config?.activated_at ?? null,
        shadow_since: config?.shadow_since ?? null,
      },
      penalty: { count: num(totals?.penalty_count), sum: num(totals?.penalty_sum) },
      bonus: { count: num(totals?.bonus_count), sum: num(totals?.bonus_sum) },
      waiver: { count: num(totals?.waiver_count), sum: num(totals?.waiver_sum) },
      couriers: num(totals?.couriers),
      shadow_count: num(totals?.shadow_count),
      /** Pol ishlagan yozuvlar — «darajalar kerakmi» signali. */
      capped_count: num(totals?.capped_count),
      /** Shtraf − bekor qilinganlar: haqiqiy ta'sir. */
      net: num(totals?.penalty_sum) - num(totals?.waiver_sum),
    };
  }

  // ══════════════════ QOIDALAR ══════════════════

  async listRules() {
    const rules = await this.manager.find(CourierPenaltyRuleEntity, {
      order: { is_active: 'DESC', created_at: 'DESC' },
    });

    /** Qamrov nomlari — ekranda uuid emas, odam o'qiydigan nom kerak. */
    const scopeIds = rules
      .map((r) => r.scope_id)
      .filter((v): v is string => !!v);
    const users = scopeIds.length
      ? await this.manager.find(UserEntity, {
          where: { id: In(scopeIds) },
          select: ['id', 'name', 'phone_number'],
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u] as const));

    return rules.map((r) => ({
      ...r,
      amount: Number(r.amount),
      max_amount: r.max_amount == null ? null : Number(r.max_amount),
      scope_name:
        r.scope_type === CourierPenaltyScope.COURIER && r.scope_id
          ? (userMap.get(r.scope_id)?.name ?? null)
          : null,
    }));
  }

  async createRule(dto: Partial<CourierPenaltyRuleEntity>, actorId: string) {
    this.assertRule(dto);
    const now = Date.now();
    const rule = this.manager.create(CourierPenaltyRuleEntity, {
      ...dto,
      created_at: now,
      updated_at: now,
      active_from: dto.active_from ?? now,
      created_by: actorId,
    } as CourierPenaltyRuleEntity);
    return this.manager.save(rule);
  }

  async updateRule(
    id: string,
    dto: Partial<CourierPenaltyRuleEntity>,
  ): Promise<CourierPenaltyRuleEntity> {
    const rule = await this.manager.findOne(CourierPenaltyRuleEntity, {
      where: { id },
    });
    if (!rule) throw new NotFoundException('Qoida topilmadi');
    Object.assign(rule, dto);
    this.assertRule(rule);
    return this.manager.save(rule);
  }

  /**
   * ⚠️ QOIDA O'CHIRILMAYDI, FAQAT SO'NDIRILADI.
   *
   * Daftar yozuvlari `rule_id` orqali qoidaga ishora qiladi: «bu shtraf
   * qaysi qoida bo'yicha yozilgan» degan savol oylar o'tib ham javobsiz
   * qolmasligi kerak. Qator o'chirilsa dalil yo'qolardi.
   */
  async deactivateRule(id: string) {
    const rule = await this.manager.findOne(CourierPenaltyRuleEntity, {
      where: { id },
    });
    if (!rule) throw new NotFoundException('Qoida topilmadi');
    rule.is_active = false;
    rule.active_to = Date.now();
    return this.manager.save(rule);
  }

  /**
   * Qoida mantiqan to'g'rimi.
   *
   * ⚠️ ISHORA TEKSHIRUVI. Shtraf MANFIY, bonus MUSBAT summa bilan
   * yoziladi va hisob yadrosi ishoraga qarab turni ajratadi. Admin
   * xato ishora kiritsa, «bonus» deb o'ylagan qoidasi SHTRAF bo'lib
   * ishlardi — va buni faqat kuryer kassasida pul ko'paygach payqashardi.
   */
  private assertRule(dto: Partial<CourierPenaltyRuleEntity>) {
    const amount = Number(dto.amount ?? 0);
    if (!Number.isFinite(amount) || amount === 0)
      throw new BadRequestException('Summa 0 bo‘lishi mumkin emas');

    if (dto.event === CourierPenaltyEvent.EARLY_MARK && amount < 0)
      throw new BadRequestException('Bonus summasi MUSBAT bo‘lishi kerak');
    if (
      (dto.event === CourierPenaltyEvent.LATE_MARK ||
        dto.event === CourierPenaltyEvent.DAMAGE) &&
      amount > 0
    )
      throw new BadRequestException('Shtraf summasi MANFIY bo‘lishi kerak');

    if (
      dto.scope_type !== CourierPenaltyScope.GLOBAL &&
      !dto.scope_id
    )
      throw new BadRequestException(
        'Kuryer yoki viloyat qamrovida nishon tanlanishi shart',
      );
    if (dto.scope_type === CourierPenaltyScope.GLOBAL && dto.scope_id)
      throw new BadRequestException('Global qoidada nishon bo‘lmaydi');

    if (Number(dto.threshold_days ?? 0) < 0)
      throw new BadRequestException('Muddat manfiy bo‘lishi mumkin emas');

    if (
      dto.active_to != null &&
      Number(dto.active_to) <= Number(dto.active_from ?? 0)
    )
      throw new BadRequestException('Tugash sanasi boshlanishdan keyin bo‘lsin');
  }

  // ══════════════════ SHTRAFNI BEKOR QILISH ══════════════════

  /**
   * SHTRAFNI BEKOR QILISH — qulflangan qaror: sabab MAJBURIY.
   *
   * ⚠️ O'CHIRISH EMAS, TESKARI YOZUV. Asl qator joyida qoladi, ustiga
   * teskari ishorali `waiver` qatori yoziladi. Sabab: daftar yig'indisi
   * kassadagi yozuvlar yig'indisiga teng turishi SHART. Asl qator
   * o'chirilsa kassa bilan daftar ajralib, invariant yiqilardi — va
   * «kim, qachon, nega bekor qildi» degan dalil ham yo'qolardi.
   *
   * Sabab YOPIQ RO'YXATDAN: erkin matn bo'lsa, oylar o'tib «nega bu
   * shtraflar bekor qilingan» degan savolga javob «asosli sabab»,
   * «kelishildi» kabi ma'nosiz qatorlar bo'lib chiqardi.
   */
  async waive(
    entryId: string,
    reason: WaiverReason,
    note: string | null,
    actorId: string,
  ) {
    if (!WAIVER_REASONS.includes(reason))
      throw new BadRequestException('Sabab yopiq ro‘yxatdan tanlanishi shart');

    return this.dataSource.transaction(async (m) => {
      const entry = await m.findOne(CourierPenaltyEntryEntity, {
        where: { id: entryId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entry) throw new NotFoundException('Yozuv topilmadi');
      if (entry.kind === 'waiver')
        throw new BadRequestException('Bekor qilish qatorini bekor qilib bo‘lmaydi');

      // Ikki marta bekor qilinmasin — teskari yozuv ikki marta yozilsa
      // kuryer qarzi asossiz kamayardi.
      const existing = await m.findOne(CourierPenaltyEntryEntity, {
        where: { waives_entry_id: entryId },
      });
      if (existing)
        throw new BadRequestException('Bu yozuv allaqachon bekor qilingan');

      const now = Date.now();
      const waiver = m.create(CourierPenaltyEntryEntity, {
        created_at: now,
        updated_at: now,
        order_id: entry.order_id,
        courier_id: entry.courier_id,
        rule_id: entry.rule_id,
        kind: 'waiver',
        reason,
        // Teskari ishora — asl yozuvni so'ndiradi.
        amount: -Number(entry.amount),
        late_days: entry.late_days,
        base_tariff: entry.base_tariff,
        /**
         * Soya holati ASL yozuvdan ko'chiriladi: soyadagi shtrafni bekor
         * qilish ham soyada qoladi, aks holda yig'indi hisobi aralashardi.
         */
        shadow: entry.shadow,
        cashbox_history_id: null,
        waives_entry_id: entry.id,
        applied_by: actorId,
        note,
      });
      return m.save(waiver);
    });
  }

  /** Kuryerlar ro'yxati — qoida va filtr tanlovlari uchun. */
  async couriers() {
    return this.manager.find(UserEntity, {
      where: { role: Roles.COURIER },
      select: ['id', 'name', 'phone_number', 'penalty_exempt', 'region_id'],
      order: { name: 'ASC' },
    });
  }

  /** Modul kaliti — faqat o'qish (yoqish Faza 3 da). */
  async config(): Promise<CourierPenaltyConfigEntity | null> {
    return this.core.loadConfig(this.manager);
  }

  /** Faol qoidalar — kuryer sanog'i bilan bir xil manba. */
  async activeRules(): Promise<PenaltyRule[]> {
    return this.core.loadRules(this.manager);
  }
}
