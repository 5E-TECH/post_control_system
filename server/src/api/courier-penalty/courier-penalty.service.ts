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
import {
  Cashbox_type,
  FinancialSource_type,
  Operation_type,
  Order_status,
  Source_type,
} from 'src/common/enums';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { applyCashboxDelta } from 'src/common/database/cashbox-delta.util';
import { calculateFinancialBalance } from 'src/common/utils/financial-balance.util';
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
        | 'id'
        | 'post_id'
        | 'courier_tariff'
        | 'where_deliver'
        // Kassa izohida ko'rinadi — kuryer qaysi buyurtma ekanini bilsin.
        | 'order_number'
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

    /**
     * ⚠️ AKTYOR ham tashqi provayder bo'lishi mumkin — «rebind» holati.
     *
     * Egalik darvozasi (`assertCourierOwnsOrder`) aktyor
     * `external_provider` bo'lsa ATAYLAB chetlab o'tiladi, ya'ni Elchi/LDG
     * webhooki HAQIQIY BeePost kuryerining pochtasidagi buyurtmani
     * belgilashi mumkin. U holda sotuv puli vakil-kuryerga, shtraf esa
     * begunoh odamga tushardi — u «men bu buyurtmani ko'rmaganman» deb
     * haqli e'tiroz bildirardi.
     *
     * Tekshiruv FAQAT aktyor pochta kuryeridan BOSHQA bo'lganda bajariladi
     * — oddiy holatda (kuryer o'z buyurtmasini belgilaydi) qo'shimcha
     * so'rov YO'Q.
     */
    if (params.actorId && params.actorId !== courier.id) {
      const actor = await manager.findOne(UserEntity, {
        where: { id: params.actorId },
        select: ['id', 'external_provider'],
      });
      if (actor?.external_provider) {
        this.logger.warn(
          `[shtraf] tashqi provayder (${actor.external_provider}) ichki ` +
            `kuryer ${courier.id} nomidan belgiladi — shtraf YOZILMADI ` +
            `(buyurtma ${order.id}).`,
        );
        return null;
      }
    }

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
       * ⚠️ LANGAR IKKI REJIMDA IKKI XIL.
       *
       * YOQILGAN: faqat `activated_at`. `shadow_since` ga TUSHIB
       * KETMASLIGI hayotiy muhim — aks holda yoqilgan kuni soya
       * boshlanganidan beri jo'natilgan HAMMA buyurtma uchun kuryerlardan
       * birdan haqiqiy pul yechilardi. Aynan shu holat migratsiya
       * izohida ogohlantirilgan.
       *
       * SOYADA: `shadow_since`. Aks holda soya hisobi butun eski
       * to'planmani bir marta sanab, yoqilgandan keyingi haqiqatdan ANCHA
       * katta raqam ko'rsatardi va muddat/narx qarori noto'g'ri tomonga
       * burilardi. Eski to'planma uchun alohida o'lchov skripti bor
       * (`npm run db:measure-courier-delay`).
       */
      activatedAt: config?.is_active
        ? (config.activated_at ?? null)
        : (config?.shadow_since ?? null),
      exempt: !!courier.penalty_exempt,
    });

    if (result.amount === 0) return null;

    /**
     * ── PUL YO'LI ─────────────────────────────────────────────────────
     *
     * ⚠️ HAMMA TEKSHIRUV DAFTARGA YOZISHDAN OLDIN. Postgres'da
     * tranzaksiya ichidagi xato BUTUN tranzaksiyani abort qiladi —
     * ya'ni bu yerdagi har qanday `throw` SOTUVNI yiqitadi. Shuning
     * uchun kassa bor-yo'qligi, bonus chegarasi va ishora mosligi
     * OLDIN hal qilinadi; keyin daftar va kassa BIR VAQTDA yoziladi.
     *
     * Natijada ikki holatdan biri bo'ladi:
     *   · ikkisi ham yozildi  → invariant toza
     *   · ikkisi ham yozilmadi → tranzaksiya qaytdi, invariant toza
     */
    let active = !!config?.is_active;
    let applied = result.amount;
    let cashbox: CashEntity | null = null;

    if (active) {
      cashbox = await manager.findOne(CashEntity, {
        where: {
          user_id: courier.id,
          cashbox_type: Cashbox_type.FOR_COURIER,
        },
      });

      if (!cashbox) {
        /**
         * Kassasiz kuryer — amalda bo'lmasligi kerak (kassa foydalanuvchi
         * yaratilganda ochiladi), lekin bo'lsa SOTUV YIQILMASIN. Shtraf
         * soyada qoladi va jurnalga xato tushadi.
         */
        this.logger.error(
          `[shtraf] kuryer ${courier.id} kassasi topilmadi — buyurtma ` +
            `${order.id} shtrafi SOYADA qoldirildi (${applied} so'm).`,
        );
        active = false;
      } else if (applied < 0) {
        /**
         * ⚠️ BONUS QARZ HAJMIDA CHEKLANADI.
         *
         * Bonus kuryer qarzini kamaytiradi. Tizimda kuryerga PUL BERISH
         * yo'li YO'Q — faqat undan olish bor (`paymentsFromCourier`).
         * Cheklovsiz bonus kassani manfiyga tushirib, hisob-kitob
         * qilinmaydigan majburiyat yaratardi.
         *
         * Bu shtrafdagi «tarif poli» qoidasining aynasi: eng yaxshi
         * holatda kuryer shu buyurtmadan qarzini NOLGA tushiradi, lekin
         * kompaniya unga qarzdor bo'lib qolmaydi.
         */
        const debt = Math.max(0, Math.trunc(Number(cashbox.balance) || 0));
        const capped = Math.min(Math.abs(applied), debt);
        if (capped === 0) return null;
        applied = -capped;
      }
    }

    /**
     * ⚠️ DAFTAR BIRINCHI, KASSA KEYIN — tartib muhim.
     *
     * `writeEntry` `orIgnore()` bilan ketadi va TAKRORIY yozuvda `null`
     * qaytaradi. Kassa yozuvi aynan shu natijaga bog'langan: aks holda
     * takroriy chaqiruvda (qisman sotuv ketma-ket, mijoz so'rovni qayta
     * yuborishi) daftarda bitta qator qolib, kassadan pul IKKI MARTA
     * yechilardi.
     */
    const entry = await this.writeEntry(
      manager,
      order.id,
      courier.id,
      { ...result, amount: applied },
      params.actorId,
      !active,
    );
    if (!entry) return null;

    if (active && cashbox) {
      const historyId = await this.applyToCashbox(manager, {
        cashbox,
        amount: applied,
        orderId: order.id,
        orderNumber: order.order_number ?? null,
        lateDays: result.lateDays,
        kind: result.kind,
        actorId: params.actorId ?? courier.id,
        markedAt: params.markedAt,
      });
      await manager.update(CourierPenaltyEntryEntity, entry.id, {
        cashbox_history_id: historyId,
      });
      entry.cashbox_history_id = historyId;
    }

    return entry;
  }

  /**
   * SHTRAF/BONUSNI KURYER KASSASIGA YOZADI va moliyaviy taroziga qayd etadi.
   *
   * ⚠️ `applyCashboxDelta` — YAGONA to'g'ri yo'l. U balansni ATOMIK
   * `UPDATE ... RETURNING` bilan o'zgartiradi va AYNI funksiyada kassa
   * tarixini ham yozadi. Xom `UPDATE cash_box` yoki faqat tarix qatori
   * yozish kassa invariantini (`balance == Σtarix`) buzadi va deploy
   * darvozasini qizil qiladi.
   *
   * ⚠️ ISHORA: kuryer kassasida musbat balans = kuryerning QARZI.
   * Shuning uchun SHTRAF `INCOME` (qarz oshadi), BONUS va bekor qilish
   * `EXPENSE`. Teskari yozilsa jazo o'rniga mukofot bo'lib qolardi.
   * `applyCashboxDelta` ichida ish-vaqtidagi ishora darvozasi ham bor.
   */
  private async applyToCashbox(
    manager: EntityManager,
    p: {
      cashbox: CashEntity;
      /** ISHORALI: musbat = shtraf, manfiy = bonus/qaytarish. */
      amount: number;
      orderId: string;
      orderNumber: number | null;
      lateDays: number;
      kind: 'penalty' | 'bonus' | 'waiver' | null;
      actorId: string;
      markedAt?: number;
      /** Teskari qaytarishda sabab matni. */
      overrideComment?: string;
    },
  ): Promise<string> {
    const delta = Math.trunc(p.amount);
    const operation =
      delta > 0 ? Operation_type.INCOME : Operation_type.EXPENSE;

    /**
     * ⚠️ IZOH MATNI — SHARTNOMA DARAJASIDA MUHIM.
     *
     * Kuryer o'z kassa tarixini xom ko'radi: o'zbekcha yorliq yo'q,
     * yagona tushuntirish shu matn. Alohida-yozuv dizaynining ikkinchi
     * sababi aynan «kuryer nega kam olganini BILSIN» edi — izoh
     * tushunarsiz bo'lsa o'sha maqsad buziladi.
     */
    const comment =
      p.overrideComment ??
      (p.kind === 'bonus'
        ? `Tez belgilash bonusi — buyurtma #${p.orderNumber ?? '—'}`
        : `Kechikkan belgilash — ${p.lateDays} kun, buyurtma #${p.orderNumber ?? '—'}`);

    const res = await applyCashboxDelta(manager, {
      cashbox: p.cashbox,
      delta,
      operation,
      source_type: Source_type.COURIER_PENALTY,
      amount: Math.abs(delta),
      source_id: p.orderId,
      comment,
      created_by: p.actorId,
    });

    /**
     * ⚠️ MOLIYAVIY TAROZI QATORI.
     *
     * Shtraf FAQAT BITTA kassani o'zgartiradi, ya'ni global tarozi
     * (`main + Σkuryer − Σmarket`) siljiydi. Sotuv foydasi uchun bunday
     * qator allaqachon yoziladi; shtraf ham daromad tan olinishi.
     * Yozilmasa «Moliyaviy balans» ekranidagi son sababsiz o'sardi.
     *
     * Naqsh `sell_profit` bilan bir xil: kassa ALLAQACHON o'zgargan,
     * shuning uchun `balance_after` = hozirgi tarozi.
     *
     * ⚠️ `balance_before`/`balance_after` — KO'RSATISH uchun suratlar,
     * qat'iy zanjir EMAS. Bitta sotuvda ikki qator bo'lsa (shtraf +
     * sotuv foydasi) ikkalasi ham ayni `balance_after` ni ko'rsatishi
     * mumkin: `sell_profit` o'z qiymatini HOZIRGI balansdan orqaga
     * hisoblaydi va u allaqachon shtrafni ham ichiga olgan bo'ladi.
     * Muhimi `amount` — yig'indilar aynan shundan olinadi. Zanjirni
     * to'g'rilash uchun chaqiruv nuqtasini surish KERAK EMAS: u
     * market `FOR UPDATE` dan keyin turishi shart (qulf tartibi
     * market → kuryer), surilsa deadlock xavfi tug'ilardi.
     */
    const balanceAfter = await calculateFinancialBalance(manager);
    await manager.save(
      manager.create(FinancialBalanceHistoryEntity, {
        amount: delta,
        balance_before: balanceAfter - delta,
        balance_after: balanceAfter,
        source_type: FinancialSource_type.COURIER_PENALTY,
        order_id: p.orderId,
        related_user_id: p.cashbox.user_id,
        comment,
        created_by: p.actorId,
      }),
    );

    return res.history_id;
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
   * SHTRAFNI TESKARI QAYTARISH — daftarda ham, kassada ham.
   *
   * Ikki chaqiruvchi: sotuvni orqaga qaytarish (`rollbackOrderToWaiting`)
   * va adminning qo'lda bekor qilishi (`waive`). Ikkalasi ham sotuv
   * tranzaksiyasi / o'z tranzaksiyasi ichida ishlaydi, shuning uchun
   * `EntityManager` parametr sifatida olinadi.
   *
   * ── ASL QATOR O'CHIRILMAYDI ─────────────────────────────────────────
   *
   * Ustiga TESKARI ishorali `waiver` qatori yoziladi. Ikki sabab:
   *
   *   1. Daftar yig'indisi kassadagi yozuvlar yig'indisiga TENG turishi
   *      shart (invariant I-CP6). Asl qator o'chirilsa ikkisi ajralardi.
   *   2. `UQ_CP_ENTRY_ORDER_REASON` indeksi `kind <> 'waiver'` qatorlarga
   *      qo'yilgan, ya'ni teskari qator unga urilmaydi — lekin ASL qator
   *      o'z o'rnida qolgani uchun QAYTA SOTUVDA yangi shtraf
   *      YOZILMAYDI. Bu ATAYLAB: rollback `post_id` ni tozalamaydi,
   *      shuning uchun qayta hisob ASL jo'natish vaqtidan boshlanib,
   *      kuryerni ADMINNING rollback kechikishi uchun jazolardi —
   *      odatda to'g'ridan-to'g'ri tarif poligacha.
   *
   * ── SOYA QATORIGA PUL QAYTARILMAYDI ─────────────────────────────────
   *
   * ⚠️ Teskari KASSA yozuvi faqat `shadow === false` VA
   * `cashbox_history_id != null` bo'lganda yoziladi. Shartsiz yozilsa,
   * hech qachon UNDIRILMAGAN soya shtrafi uchun kuryerga HAQIQIY pul
   * qaytarilardi — jazo o'rniga mukofot.
   *
   * @returns teskari qaytarilgan qatorlar soni.
   */
  async reverseForOrder(
    manager: EntityManager,
    params: {
      orderId: string;
      /** Teskari qatorning sababi — yopiq ro'yxatdan yoki tizim sababi. */
      reason: string;
      actorId: string;
      note?: string | null;
      /** Faqat shu id li yozuv (qo'lda bekor qilish uchun). */
      entryId?: string;
    },
  ): Promise<number> {
    const where: Record<string, unknown> = { order_id: params.orderId };
    if (params.entryId) where.id = params.entryId;

    const entries = await manager.find(CourierPenaltyEntryEntity, { where });
    const live = entries.filter((e) => e.kind !== 'waiver');
    if (!live.length) return 0;

    // Allaqachon teskari qaytarilganlarni ikkinchi marta qaytarmaymiz —
    // aks holda kuryer qarzi asossiz kamayardi.
    const already = new Set(
      entries
        .map((e) => e.waives_entry_id)
        .filter((v): v is string => !!v),
    );

    let reversed = 0;
    for (const entry of live) {
      if (already.has(entry.id)) continue;

      /**
       * ⚠️ `Number()` MAJBURIY. Daftar qatori ba'zi yo'llarda xom SQL'dan
       * keladi va `bigint` ustunlar SATR bo'lib chiqadi. Satrda `-x`
       * ishlaydi-yu, `x + y` konkatenatsiya berib summani jimgina
       * buzardi.
       */
      const amount = Math.trunc(Number(entry.amount) || 0);
      if (amount === 0) continue;

      const now = Date.now();
      const waiver = manager.create(CourierPenaltyEntryEntity, {
        created_at: now,
        updated_at: now,
        order_id: entry.order_id,
        courier_id: entry.courier_id,
        rule_id: entry.rule_id,
        kind: 'waiver',
        reason: params.reason,
        amount: -amount,
        late_days: entry.late_days,
        base_tariff: entry.base_tariff,
        // Soya holati ASL qatordan ko'chiriladi: soyadagi shtrafni bekor
        // qilish ham soyada qoladi, aks holda yig'indi hisobi aralashardi.
        shadow: entry.shadow,
        cashbox_history_id: null,
        waives_entry_id: entry.id,
        applied_by: params.actorId,
        note: params.note ?? null,
      });

      // ⚠️ PUL FAQAT HAQIQIY YOZUVGA QAYTARILADI.
      if (!entry.shadow && entry.cashbox_history_id) {
        const cashbox = await manager.findOne(CashEntity, {
          where: {
            user_id: entry.courier_id,
            cashbox_type: Cashbox_type.FOR_COURIER,
          },
        });
        if (!cashbox) {
          this.logger.error(
            `[shtraf] teskari qaytarish: kuryer ${entry.courier_id} ` +
              `kassasi topilmadi, yozuv ${entry.id} daftarda qoldi.`,
          );
        } else {
          waiver.cashbox_history_id = await this.applyToCashbox(manager, {
            cashbox,
            amount: -amount,
            orderId: entry.order_id,
            orderNumber: null,
            lateDays: entry.late_days ?? 0,
            kind: 'waiver',
            actorId: params.actorId,
            overrideComment: `Shtraf bekor qilindi (${params.reason})`,
          });
        }
      }

      await manager.save(waiver);
      reversed += 1;
    }

    return reversed;
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
    /** `true` = soya: pulga tegilmagan, faqat qayd etilgan. */
    shadow = true,
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
        /**
         * ⚠️ `shadow` — modul YOQILGANMI degan savolning javobi.
         *
         * `false` bo'lsa kuryer kassasiga haqiqiy pul yozilgan va
         * `cashbox_history_id` to'ldirilishi SHART (invariant I-CP1).
         * Soya qatorlari keyin «real»ga AYLANMAYDI: backfill qilinsa
         * kuryerlardan ogohlantirmasdan o'tgan davr uchun pul yechilardi.
         */
        shadow,
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
