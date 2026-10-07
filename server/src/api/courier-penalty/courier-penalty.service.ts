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
  type PenaltyResult,
  type PenaltyRule,
} from '../order/utils/courier-penalty.util';

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
   * Shtraf CHEGARASI olinadigan tarif.
   *
   * Buyurtmadagi yozilgan tarif ustun: sotuvda u AYNAN kuryerga
   * hisoblangan summa. Bekor qilishda esa ustun bo'sh qoladi (bekorda
   * tarif to'lanmaydi) — u holda kuryerning stavkasi olinadi, ya'ni
   * «shu buyurtma ko'pi bilan qancha keltirardi» degan chegara.
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

  /** Kalit qatori; yo'q bo'lsa `null` — hisob soya sifatida davom etadi. */
  private async loadConfig(
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
  private async loadRules(manager: EntityManager): Promise<PenaltyRule[]> {
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
