import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CourierPenaltyConfigEntity } from 'src/core/entity/courier-penalty-config.entity';
import { CourierPenaltyRuleEntity } from 'src/core/entity/courier-penalty-rule.entity';
import { CourierPenaltyEntryEntity } from 'src/core/entity/courier-penalty-entry.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { Where_deliver } from 'src/common/enums';
import {
  computeCourierAdjustment,
  CourierPenaltyEvent,
  deadlineStateOf,
  pickRule,
  type PenaltyResult,
  type PenaltyRule,
} from '../order/utils/courier-penalty.util';
import { Order_status } from 'src/common/enums';
import type {
  CourierDeadlineReport,
  CourierDeadlineRow,
} from './courier-penalty.types';

/**
 * KURYER SHTRAF / BONUS — DAFTARGA YOZUVCHI SERVIS.
 *
 * Hisobning O'ZI bu yerda EMAS: u `courier-penalty.util.ts` da, DB'siz sof
 * funksiya sifatida yashaydi. Bu servis uch ishni qiladi: ma'lumot yig'ish
 * → hisobni chaqirish → daftarga yozish.
 *
 * ── MAS'UL KURYER POCHTADAN OLINADI ─────────────────────────────────────
 *
 * ⚠️ `order` jadvalida `courier_id` ustuni YO'Q — kuryer bog'lanishi
 * `order.post_id → post.courier_id` orqali boradi. Bu tasodifan juda
 * qulay: jo'natish langari (`post.created_at`) va mas'ul kuryer AYNI
 * qatordan keladi, ya'ni ular bir-biriga mos kelmasligi MUMKIN EMAS.
 *
 * Shu sababli shtraf AMAL QILUVCHIGA emas, POCHTA KURYERIGA yoziladi.
 * Farqi muhim: kechikkan buyurtmani ko'pincha admin kuryer nomidan
 * belgilaydi. Amal qiluvchiga yozilsa shtraf ADMIN ga tushardi, kuryer esa
 * «admin belgilab bersin» deb yana ham kech harakat qilardi.
 *
 * ── NEGA SOTUV TRANZAKSIYASI ICHIDA ─────────────────────────────────────
 *
 * Servis O'Z tranzaksiyasini OCHMAYDI — chaqiruvchining `EntityManager`
 * ini oladi (`ExtraCostApplierService` ayni naqsh). Sabab: sotuv rollback
 * bo'lsa shtraf yozuvi ham yo'qolishi SHART, aks holda bajarilmagan sotuv
 * uchun kuryerda shtraf qolib ketardi.
 *
 * ── NEGA XATO SOTUVNI YIQITMAYDI ────────────────────────────────────────
 *
 * Yozuv `orIgnore()` bilan ketadi: idempotentlik indeksi
 * (`UQ_CP_ENTRY_ORDER_REASON`) qoqilganda `ON CONFLICT DO NOTHING` bo'ladi
 * va xato TASHLANMAYDI. Bu muhim — Postgres'da tranzaksiya ichidagi xato
 * BUTUN tranzaksiyani abort qiladi, ya'ni `try/catch` bilan ushlab ham
 * sotuvni qutqarib bo'lmasdi. Shuning uchun yagona real xato manbai
 * (takroriy yozuv) DB darajasida yumshoq qilingan.
 */
@Injectable()
export class CourierPenaltyService {
  private readonly logger = new Logger(CourierPenaltyService.name);

  /**
   * Buyurtma belgilanganda tuzatishni hisoblaydi va daftarga yozadi.
   *
   * ⚠️ FAZA 1 — SOYA: kassaga TEGILMAYDI. Yozuv `shadow = true` bilan
   * ketadi, `cashbox_history_id` esa `null` qoladi. Pul yo'li Faza 3 da.
   *
   * @param order  `save()` qilingandan KEYINGI holat (tarif yozilgan bo'lsin)
   * @param markedAt kuryer «sotildi»/«bekor» bosgan payt — chaqiruvchi
   *        AYNAN qaysi ustunni qo'yganini biladi (`sold_at` yoki
   *        `cancelled_at`), shu sabab bu yerda taxmin qilinmaydi.
   * @returns yozilgan daftar qatori, tuzatish bo'lmasa `null`.
   */
  async recordForOrder(
    manager: EntityManager,
    params: {
      order: Pick<
        OrderEntity,
        'id' | 'post_id' | 'courier_tariff' | 'where_deliver'
      >;
      markedAt: number;
      actorId?: string | null;
    },
  ): Promise<CourierPenaltyEntryEntity | null> {
    const { order } = params;

    /**
     * Pochtasiz buyurtma — langar ham, mas'ul kuryer ham yo'q.
     *
     * Bu ATAYLAB jim o'tish: jo'natilmagan posilka uchun «kechikish»
     * o'lchovi mavjud emas.
     */
    if (!order?.post_id) return null;

    const post = await manager.findOne(PostEntity, {
      where: { id: order.post_id },
      select: ['id', 'created_at', 'courier_id', 'region_id'],
    });
    if (!post?.courier_id) return null;

    const courier = await manager.findOne(UserEntity, {
      where: { id: post.courier_id },
      select: [
        'id',
        'external_provider',
        'penalty_exempt',
        'region_id',
        'tariff_center',
        'tariff_home',
      ],
    });
    if (!courier) return null;

    /**
     * ⚠️ TASHQI PROVAYDER ISTISNOSI.
     *
     * Elchi/LDG posilkalarini virtual vakil-kuryer (`external_provider`)
     * nomidan webhook belgilaydi. Belgilash vaqti bizning kuryerimizning
     * ishiga bog'liq emas — u yerda boshqa kompaniyaning oqimi. Bu darvoza
     * bo'lmasa tizim mavjud bo'lmagan odamga shtraf yozardi.
     */
    if (courier.external_provider) return null;

    const [config, rules] = await Promise.all([
      this.loadConfig(manager),
      this.loadRules(manager),
    ]);

    const result = computeCourierAdjustment({
      dispatchedAt: post.created_at,
      markedAt: params.markedAt,
      baseTariff: this.baseTariffOf(order, courier),
      courierId: courier.id,
      /**
       * Viloyat qoidasi («uzoq hududga 7 kun») YETKAZISH viloyatiga
       * bog'lanadi — pochta qayerga ketgan bo'lsa o'sha. Kuryerning
       * ro'yxatdagi viloyati zaxira: eski pochtalarda `region_id` null
       * bo'lishi mumkin.
       */
      regionId: post.region_id ?? courier.region_id ?? null,
      rules,
      /**
       * ⚠️ SOYADA LANGAR — `shadow_since`.
       *
       * Yoqilgandan keyin langar `activated_at` bo'ladi. Soyada esa
       * `shadow_since` ishlatiladi: aks holda soya hisobi butun eski
       * to'planmani bir marta sanab, yoqilgandan keyingi haqiqatdan ANCHA
       * katta raqam ko'rsatardi va muddat/narx qarori noto'g'ri tomonga
       * burilardi. Eski to'planma uchun alohida o'lchov skripti bor
       * (`npm run db:measure-courier-delay`).
       */
      activatedAt: config?.activated_at ?? config?.shadow_since ?? null,
      exempt: !!courier.penalty_exempt,
    });

    if (result.amount === 0) return null;

    if (config?.is_active) {
      /**
       * Modul yoqilgan, lekin kassa ulanishi hali YO'Q (Faza 3).
       *
       * Bu holatga faqat qo'lda SQL bilan tushish mumkin — yoqish ekrani
       * Faza 2 da keladi. Jim o'tib ketmaymiz: aks holda admin «yoqdim»
       * deb o'ylab, aslida hech kim shtraf to'lamayotganini bilmasdi.
       */
      this.logger.error(
        `[shtraf] modul YOQILGAN, lekin kassa ulanishi hali qo'shilmagan ` +
          `(Faza 3). Buyurtma ${order.id} uchun ${result.amount} so'm faqat ` +
          `daftarga yozildi, kassaga TEGILMADI.`,
      );
    }

    return this.writeEntry(manager, order.id, courier.id, result, params.actorId);
  }


  /**
   * KURYERNING O'Z MUDDATLARI — ekrandagi sanoq va ogohlantirish.
   *
   * ⚠️ NEGA SHTRAF HISOBINI QAYTA CHAQIRADI. «Qancha shtraf bo'lishi
   * mumkin» sonini bu yerda qo'lda hisoblash (kun × narx) oson edi, lekin
   * u pol, qoida chegarasi, qamrov aniqligi va grandfathering darvozasini
   * TAKRORLASHNI talab qilardi. Ikki nusxa vaqt o'tib ajralib ketadi va
   * ekran kassaga qarshi chiqadi — kuryer «menga 12 000 deb turgan edi»
   * deb haqli e'tiroz bildirardi. Shuning uchun AYNI
   * `computeCourierAdjustment` ikki marta chaqiriladi: hozirga va ertaga.
   *
   * Qaytaradi: modul holati, umumiy xulosa va har buyurtma uchun sanoq.
   */
  async myDeadlines(
    manager: EntityManager,
    courierId: string,
    now = Date.now(),
  ): Promise<CourierDeadlineReport> {
    const courier = await manager.findOne(UserEntity, {
      where: { id: courierId },
      select: [
        'id',
        'external_provider',
        'penalty_exempt',
        'region_id',
        'tariff_center',
        'tariff_home',
      ],
    });

    const exempt = !!courier?.external_provider || !!courier?.penalty_exempt;
    const [config, rules] = await Promise.all([
      this.loadConfig(manager),
      this.loadRules(manager),
    ]);

    const empty: CourierDeadlineReport = {
      module: {
        /** `false` — soya: sanoq ko'rinadi, pul YECHILMAYDI. */
        active: !!config?.is_active,
        exempt,
      },
      summary: {
        pending: 0,
        due_today: 0,
        overdue: 0,
        penalty_now: 0,
        penalty_tomorrow: 0,
        penalty_max: 0,
      },
      orders: [],
    };
    if (!courier || exempt) return empty;

    /**
     * Kuryerning HAL QILINMAGAN buyurtmalari — `allCouriersOrdersCounts`
     * dagi «waiting» ta'rifi bilan AYNI: o'z pochtalaridagi `waiting`
     * holatdagilar. Shtraf ham aynan shu holatdan chiqishda yoziladi.
     *
     * ⚠️ Pochta QABUL QILINGANI tekshirilmaydi — soat jo'natilganda
     * boshlanadi (qulflangan qaror). Aks holda kuryer pochtani kech qabul
     * qilib sanoqni kechiktirardi.
     */
    const rows: Array<{
      id: string;
      order_number: number | null;
      courier_tariff: string | null;
      where_deliver: string;
      post_created_at: string;
      post_region_id: string | null;
      market_name: string | null;
    }> = await manager
      .createQueryBuilder()
      .select([
        'o.id AS id',
        'o.order_number AS order_number',
        'o.courier_tariff AS courier_tariff',
        'o.where_deliver AS where_deliver',
        'p.created_at AS post_created_at',
        'p.region_id AS post_region_id',
        'm.name AS market_name',
      ])
      .from(OrderEntity, 'o')
      .innerJoin(PostEntity, 'p', 'p.id = o.post_id')
      .leftJoin(UserEntity, 'm', 'm.id = o.user_id')
      .where('p.courier_id = :courierId', { courierId })
      .andWhere('o.status = :st', { st: Order_status.WAITING })
      .andWhere('o.deleted_at IS NULL')
      .orderBy('p.created_at', 'ASC')
      .getRawMany();

    const activatedAt = config?.activated_at ?? config?.shadow_since ?? null;
    const orders: CourierDeadlineRow[] = [];

    for (const r of rows) {
      /**
       * ⚠️ `numeric`/`bigint` xom SQL'dan SATR bo'lib keladi — `Number()`
       * shart, aks holda `'1790' + 1` = `'17901'` bo'lib sanoq buzilardi.
       */
      const dispatchedAt = Number(r.post_created_at);
      const baseTariff = this.baseTariffOf(
        {
          courier_tariff:
            r.courier_tariff == null ? null : Number(r.courier_tariff),
          where_deliver: r.where_deliver as never,
        },
        courier,
      );
      const regionId = r.post_region_id ?? courier.region_id ?? null;

      // Qaysi muddat amal qiladi — qamrov aniqligi bilan (uzoq hudud 7 kun).
      const rule = pickRule(
        rules,
        CourierPenaltyEvent.LATE_MARK,
        now,
        courierId,
        regionId,
      );
      const state = deadlineStateOf(
        dispatchedAt,
        now,
        rule?.threshold_days ?? 0,
      );
      if (!rule || !state) continue;

      const common = {
        baseTariff,
        courierId,
        regionId,
        rules,
        activatedAt,
        dispatchedAt,
      };
      const nowResult = computeCourierAdjustment({ ...common, markedAt: now });
      const tomorrow = computeCourierAdjustment({
        ...common,
        markedAt: now + 86_400_000,
      });

      /**
       * Grandfathering darvozasi yopiq bo'lsa (modul yoqilishidan oldin
       * jo'natilgan) — bu buyurtma umuman shtrafga tushmaydi. Ro'yxatda
       * ko'rsatamiz, lekin summalari 0 va `immune` belgisi bilan: kuryer
       * «nega bunga shtraf yo'q» deb hayron bo'lmasin.
       */
      const immune = nowResult.skipReason === 'before_activation';

      orders.push({
        id: r.id,
        /**
         * ⚠️ `bigint` xom SQL'dan SATR bo'lib keladi. Klient uni raqam deb
         * ishlatadi (tartiblash, solishtirish) — satr qolsa `'100155' + 1`
         * `'1001551'` bo'lib ketardi.
         */
        order_number: r.order_number == null ? null : Number(r.order_number),
        market_name: r.market_name,
        dispatched_at: dispatchedAt,
        deadline_at: state.penaltyStartsAt,
        deadline_days: rule.threshold_days,
        ms_left: state.msLeft,
        days_left: state.daysLeft,
        late_days: state.lateDays,
        due_today: state.dueToday,
        penalty_now: nowResult.amount,
        penalty_tomorrow: tomorrow.amount,
        // Eng yomon holat — pol: shtraf tarifdan oshmaydi.
        penalty_max: immune ? 0 : baseTariff,
        capped: nowResult.cappedByTariff,
        immune,
      });
    }

    return {
      module: empty.module,
      summary: {
        pending: orders.length,
        due_today: orders.filter((o) => o.due_today && !o.immune).length,
        overdue: orders.filter((o) => o.late_days > 0 && !o.immune).length,
        penalty_now: orders.reduce((a, o) => a + o.penalty_now, 0),
        penalty_tomorrow: orders.reduce((a, o) => a + o.penalty_tomorrow, 0),
        /**
         * Eng yomon holat — faqat SHTRAFGA TUSHA OLADIGAN buyurtmalar
         * tariflari yig'indisi. `immune` lar qo'shilmaydi, aks holda son
         * hech qachon yetib bo'lmaydigan darajada katta ko'rinardi.
         */
        penalty_max: orders.reduce((a, o) => a + o.penalty_max, 0),
      },
      orders,
    };
  }

  /**
   * Shtraf CHEGARASI olinadigan tarif.
   *
   * Buyurtmadagi yozilgan tarif ustun: sotuvda u AYNAN kuryerga
   * hisoblangan summa. Bekor qilishda esa ustun bo'sh qoladi — u holda
   * kuryerning stavkasi olinadi.
   *
   * ── ⚠️ QULFLANGAN QAROR: BEKORDA SHTRAF CHO'NTAKDAN OLINADI ──────────
   *
   * Bu YERDA ZIDDIYAT BOR va u ATAYLAB shunday qoldirilgan. Buni
   * «tuzatish» uchun qo'l urishdan oldin oxirigacha o'qing.
   *
   * Qoida: «shtraf 0 gacha tushsin, undan pastga emas».
   *
   *   SOTUVDA bu mukammal ishlaydi: shtraf tarifdan oshmaydi, ya'ni
   *   kuryer eng yomon holatda shu buyurtmadan HECH NARSA olmaydi,
   *   lekin USTIGA TO'LAMAYDI.
   *
   *   BEKORDA esa kuryerga tarif UMUMAN to'lanmaydi (`cancelOrder`
   *   kuryer kassasiga birorta yozuv yozmaydi — jonli sinov bilan
   *   tasdiqlangan). Ya'ni uning shu buyurtmadagi daromadi allaqachon
   *   NOL. Shtraf esa uning BOSHQA buyurtmalardan ishlagan pulidan
   *   yechiladi — bu cho'ntakdan to'lash.
   *
   * Qoidani so'zma-so'z o'qisak, bekorga shtraf UMUMAN bo'lmasligi kerak
   * edi. SHUNDAY QILINMADI, chunki u holda kuryer uchun eng foydali
   * strategiya ochiq-oydin bo'lardi: sotuvni vaqtida bosib, bekorni
   * UMUMAN bosmaslik. Bekorlar abadiy `waiting` bo'lib qolardi, market
   * moli muzlab turaverardi va modul o'z maqsadining yarmini bajarardi.
   *
   * Shuning uchun chegara shu buyurtma «ko'pi bilan qancha keltirardi»
   * degan summa — kuryerning stavkasi. Cho'ntakdan ketishi MA'LUM va
   * QABUL QILINGAN narx (foydalanuvchi qarori, 2026-10-07).
   *
   * Qulf: `courier-penalty.service.spec.ts` → «bekor yo'li — qulflangan
   * qaror». Qarorni o'zgartirmoqchi bo'lsangiz o'sha test yiqiladi va
   * sizni shu izohga qaytaradi.
   */
  private baseTariffOf(
    order: Pick<OrderEntity, 'courier_tariff' | 'where_deliver'>,
    courier: Pick<UserEntity, 'tariff_center' | 'tariff_home'>,
  ): number {
    if (order.courier_tariff != null) return Number(order.courier_tariff);
    return Number(
      (order.where_deliver === Where_deliver.CENTER
        ? courier.tariff_center
        : courier.tariff_home) ?? 0,
    );
  }

  /**
   * Kalit qatori; yo'q bo'lsa `null` — hisob soya sifatida davom etadi.
   *
   * ⚠️ OCHIQ: admin servisi ham AYNI shu manbadan o'qiydi. Nusxasini
   * yozsa, admin ekrani bilan sotuv yo'li turli kalitni ko'rib qolishi
   * mumkin edi.
   */
  async loadConfig(
    manager: EntityManager,
  ): Promise<CourierPenaltyConfigEntity | null> {
    return manager.findOne(CourierPenaltyConfigEntity, {
      where: {},
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Faol qoidalar. Jadval KICHIK (bir necha qator) — har belgilashda
   * to'liq o'qiladi, kesh YO'Q: admin qoidani o'zgartirgan zahoti kuchga
   * kirishi kerak, keshlangan nusxa esa «nega hali ham eski summa» degan
   * tushunarsiz holat tug'dirardi.
   */
  async loadRules(manager: EntityManager): Promise<PenaltyRule[]> {
    const rows = await manager.find(CourierPenaltyRuleEntity, {
      where: { is_active: true },
    });
    return rows.map((r) => ({
      id: r.id,
      scope_type: r.scope_type,
      scope_id: r.scope_id,
      event: r.event,
      threshold_days: Number(r.threshold_days),
      calc: r.calc,
      amount: Number(r.amount),
      max_amount: r.max_amount == null ? null : Number(r.max_amount),
      priority: Number(r.priority),
      active_from: Number(r.active_from),
      active_to: r.active_to == null ? null : Number(r.active_to),
      is_active: r.is_active,
    }));
  }

  /**
   * Daftar qatorini yozadi.
   *
   * `orIgnore()` — idempotentlik: ayni buyurtmaga ayni hodisa IKKI MARTA
   * yozilmaydi (qisman sotuv ketma-ket chaqirilsa yoki mijoz so'rovni
   * qayta yuborsa). Konflikt xato EMAS, jim o'tish.
   */
  private async writeEntry(
    manager: EntityManager,
    orderId: string,
    courierId: string,
    result: PenaltyResult,
    actorId?: string | null,
  ): Promise<CourierPenaltyEntryEntity | null> {
    const now = Date.now();
    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(CourierPenaltyEntryEntity)
      .values({
        created_at: now,
        updated_at: now,
        order_id: orderId,
        courier_id: courierId,
        rule_id: result.ruleId,
        kind: result.kind as string,
        reason: result.event as string,
        amount: result.amount,
        late_days: result.lateDays,
        base_tariff: result.baseTariff,
        // ⚠️ FAZA 1: DOIM soya. Kassa ulanishi Faza 3 da qo'shiladi.
        shadow: true,
        cashbox_history_id: null,
        waives_entry_id: null,
        applied_by: actorId ?? null,
        note: null,
      })
      .orIgnore()
      .returning('*')
      .execute();

    const saved = inserted.raw?.[0];
    return saved ? (saved as CourierPenaltyEntryEntity) : null;
  }
}
