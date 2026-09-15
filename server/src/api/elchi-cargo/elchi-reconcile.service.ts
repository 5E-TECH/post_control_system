import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ElchiConfigEntity } from 'src/core/entity/elchi-config.entity';
import { ElchiShipmentEntity } from 'src/core/entity/elchi-shipment.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { Where_deliver } from 'src/common/enums';
import { ElchiApiService } from './elchi-api.service';
import { ElchiWebhookService } from './elchi-webhook.service';
import { normalizeElchiStatus } from './utils/elchi-status.mapper';
import { ElchiShipmentStatusResponse } from './dto/elchi-api.dto';

/**
 * Elchi tomonda BOSHQA O'ZGARMAYDIGAN statuslar — bunday posilkalar
 * so'rovlardan chiqariladi (aks holda CRON abadiy ularni tekshirib yurardi).
 */
const TERMINAL_ELCHI_STATUSES = [
  'sold',
  'paid',
  'partly_paid',
  'cancelled',
  'cancelled (sent)',
  'returned_to_market',
  'closed',
];

/**
 * Elchi tomonda "yetkazilgan/sotilgan" deb hisoblanadigan statuslar.
 *
 * Pul tekshiruvi FAQAT shularda ishlaydi: tarif ayni sotuvda ushlanadi,
 * undan oldin `to_be_paid` to'liq COD ga teng bo'lib turadi.
 */
const SOLD_ELCHI_STATUSES = ['sold', 'paid', 'partly_paid'];

/**
 * Bitta tikda tekshiriladigan posilka soni.
 *
 * `ElchiApiService`da global navbat bor (600ms) — 40 ta so'rov ~24 soniya
 * oladi. 15 daqiqalik tik uchun bu xavfsiz va Elchi rate-limitidan oshmaydi.
 */
const RECONCILE_BATCH = 40;

export interface ElchiReconcileResult {
  checked: number;
  applied: number;
  unchanged: number;
  mismatched: number;
  failed: number;
}

/**
 * Elchi holatlarini solishtiruvchi (reconcile) xizmat.
 *
 * ⚠️ NEGA MAJBURIY, IXTIYORIY EMAS. Elchi chiquvchi webhookni outbox orqali
 * yuboradi va **4 urinishdan keyin `permanently_failed` deb belgilab, boshqa
 * HECH QACHON urinmaydi**. Ya'ni tarmoq uzilishi yoki bizning deploy oynasi
 * webhookni butunlay yo'q qilishi mumkin. Bunday buyurtma bizda abadiy
 * "kutilmoqda" holatida qolib ketardi — pul esa Elchi'da yig'ilgan bo'lardi.
 *
 * Shu bois: har 15 daqiqada ochiq posilkalarni Elchi'dan SO'RAB, holatni
 * webhook bilan AYNI mantiq orqali qo'llaydi
 * (`ElchiWebhookService.applyStatusUpdate`) — ikki yo'l ajralib ketmasligi
 * uchun.
 *
 * Aylanish kafolati: posilkalar `last_synced_at ASC NULLS FIRST` tartibida
 * olinadi va status o'zgarmasa ham bu maydon YANGILANADI. Shunda hech bir
 * posilka "qolib ketmaydi" — LDG'da 100 ta limit tufayli aynan shu muammo
 * bo'lgan.
 */
@Injectable()
export class ElchiReconcileService {
  private readonly logger = new Logger(ElchiReconcileService.name);

  /**
   * Bir vaqtda bitta aylanish. Ko'p instansiyali deployda bu himoya to'liq
   * emas, lekin qo'llash mantig'i idempotent (terminal holatlar skip qilinadi),
   * shu bois ustma-ust tik zarar keltirmaydi — faqat ortiqcha so'rov bo'ladi.
   */
  private running = false;

  constructor(
    @InjectRepository(ElchiConfigEntity)
    private readonly configRepo: Repository<ElchiConfigEntity>,
    @InjectRepository(ElchiShipmentEntity)
    private readonly shipmentRepo: Repository<ElchiShipmentEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly api: ElchiApiService,
    private readonly webhookService: ElchiWebhookService,
  ) {}

  @Cron('0 */15 * * * *', { timeZone: 'Asia/Tashkent' })
  async scheduledReconcile(): Promise<void> {
    if (this.running) {
      this.logger.warn('Elchi solishtirish hali ishlayapti — tik o‘tkazildi');
      return;
    }
    this.running = true;
    try {
      const result = await this.reconcileBatch();
      if (result.checked > 0) {
        this.logger.log(
          `Elchi solishtirish: tekshirildi=${result.checked} ` +
            `qo'llanildi=${result.applied} o'zgarmagan=${result.unchanged} ` +
            `nomuvofiq=${result.mismatched} xato=${result.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Elchi solishtirish yiqildi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Bir partiya ochiq posilkani Elchi bilan solishtiradi.
   *
   * Admin panel "Elchi bilan tenglashtirish" tugmasi ham shuni chaqiradi
   * (CRON'ni kutmasdan).
   */
  async reconcileBatch(limit = RECONCILE_BATCH): Promise<ElchiReconcileResult> {
    const result: ElchiReconcileResult = {
      checked: 0,
      applied: 0,
      unchanged: 0,
      mismatched: 0,
      failed: 0,
    };

    const config = await this.configRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    // Kill-switch: master yoki solishtirish o'chirilgan bo'lsa hech narsa
    // qilmaymiz (so'rov ham yubormaymiz).
    if (!config || !config.is_active || !config.reconcile_enabled) {
      return result;
    }

    const shipments = await this.findOpenShipments(limit);
    if (!shipments.length) return result;

    for (const shipment of shipments) {
      result.checked += 1;
      try {
        const outcome = await this.reconcileShipment(config, shipment);
        if (outcome === 'applied') result.applied += 1;
        else if (outcome === 'mismatch') result.mismatched += 1;
        else result.unchanged += 1;
      } catch (error) {
        result.failed += 1;
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Elchi solishtirish xatosi (order=${shipment.order_id}): ${msg}`,
        );
        // Xato bo'lsa ham `last_synced_at`ni yangilaymiz — aks holda ayni
        // muammoli posilka navbatni bloklab, qolganlari tekshirilmay qolardi.
        await this.touchSynced(shipment.id);
      }
    }

    config.last_reconcile_at = Date.now();
    await this.configRepo.save(config);

    return result;
  }

  /**
   * Bitta posilkani Elchi bilan solishtiradi (admin "sinxronlash" tugmasi).
   */
  async reconcileOne(orderId: string): Promise<{
    checked: boolean;
    outcome?: 'applied' | 'unchanged' | 'mismatch';
    note?: string;
  }> {
    const config = await this.configRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (!config) return { checked: false, note: "Sozlama yo'q" };

    const shipment = await this.shipmentRepo.findOne({
      where: { order_id: orderId },
    });
    if (!shipment?.elchi_shipment_id) {
      return { checked: false, note: "Posilka Elchi'da bog'lanmagan" };
    }

    const outcome = await this.reconcileShipment(config, shipment);
    return { checked: true, outcome };
  }

  // ===================== ICHKI =====================

  /**
   * Ochiq posilkalar: Elchi id'si bor va Elchi statusi TERMINAL emas.
   *
   * `last_synced_at ASC NULLS FIRST` — hech tekshirilmaganlar birinchi, keyin
   * eng eski tekshirilganlar. Bu aylanishni kafolatlaydi.
   */
  private async findOpenShipments(
    limit: number,
  ): Promise<ElchiShipmentEntity[]> {
    return (
      this.shipmentRepo
        .createQueryBuilder('s')
        .where('s.elchi_shipment_id IS NOT NULL')
        // NULL statusni ham olamiz: jo'natilgan-u, hali hech qanday xabar
        // kelmagan posilka — aynan eng shubhali holat.
        .andWhere(
          '(s.elchi_status IS NULL OR LOWER(s.elchi_status) NOT IN (:...terminal))',
          { terminal: TERMINAL_ELCHI_STATUSES },
        )
        .orderBy('s.last_synced_at', 'ASC', 'NULLS FIRST')
        .limit(limit)
        .getMany()
    );
  }

  /**
   * Elchi'dan holatni so'rab, o'zgargan bo'lsa webhook bilan AYNI mantiq
   * orqali qo'llaydi.
   */
  private async reconcileShipment(
    config: ElchiConfigEntity,
    shipment: ElchiShipmentEntity,
  ): Promise<'applied' | 'unchanged' | 'mismatch'> {
    const remote = await this.api.getShipment(shipment.elchi_shipment_id!);
    const remoteStatus = String(remote?.status ?? '').trim();

    if (!remoteStatus) {
      await this.touchSynced(shipment.id);
      return 'unchanged';
    }

    // Status o'zgarmagan — faqat "tekshirildi" belgisini yangilaymiz.
    if (
      normalizeElchiStatus(remoteStatus) ===
      normalizeElchiStatus(shipment.elchi_status ?? '')
    ) {
      await this.touchSynced(shipment.id);
      return 'unchanged';
    }

    this.logger.log(
      `Elchi solishtirish: order=${shipment.order_id} ` +
        `${shipment.elchi_status ?? '-'} -> ${remoteStatus} ` +
        `(webhook yo'qolgan bo'lishi mumkin)`,
    );

    /**
     * `cod_collected` — Elchi marketga ALLAQACHON TO'LAB BERGAN qismi
     * (`paid_amount`). Oddiy sotuvda 0 bo'ladi; hisob-kitob (settlement)
     * uchun qayd etiladi.
     *
     * ⚠️ U "kuryer mijozdan yiqqan pul" EMAS — Elchi kodidagi izoh shunday
     * deydi, lekin haqiqatda unday emas. Pul solishtiruvi shu maydonga
     * tayanmaydi, `verifyMoney` boshqa mantiqda ishlaydi (pastda).
     */
    const outcome = await this.webhookService.applyStatusUpdate(config, {
      event: 'shipment.status_changed',
      external_order_id: shipment.order_id,
      shipment_id: shipment.elchi_shipment_id ?? undefined,
      status: remoteStatus,
      cod_collected: Number.isFinite(Number(remote?.cod_collected))
        ? Number(remote?.cod_collected)
        : undefined,
      /**
       * HAQIQIY PUL MAYDONLARI (audit M2) — WEBHOOK BILAN AYNI.
       *
       * ⚠️ BU YERDA UZATILMASA TUZATISH YARIM QOLARDI. Hozir BeePost
       * hamkorida `webhook_url` bo'sh, ya'ni status ma'lumoti FAQAT shu
       * CRON orqali keladi. Agar maydonlar faqat webhook yo'lida
       * saqlangan bo'lsa, hisob-kitob paneli abadiy bo'sh qolardi va
       * "tuzatdik" degan xato ishonch paydo bo'lardi.
       *
       * `null` SAQLANADI, `undefined` ga aylantirilmaydi: 0 va `null`
       * boshqa ma'noda (0 = naqd yig'ilmadi, null = hali hisoblanmagan).
       */
      collected_from_customer:
        remote?.collected_from_customer === null
          ? null
          : Number.isFinite(Number(remote?.collected_from_customer))
            ? Number(remote?.collected_from_customer)
            : undefined,
      elchi_fee:
        remote?.elchi_fee === null
          ? null
          : Number.isFinite(Number(remote?.elchi_fee))
            ? Number(remote?.elchi_fee)
            : undefined,
      // Elchi yakuniy narxni o'zgartirgan bo'lsa, sotishdan OLDIN bizda ham
      // qo'llanadi — aks holda kassaga eski narx bo'yicha xato summa tushardi.
      total_price: Number.isFinite(Number(remote?.total_price))
        ? Number(remote?.total_price)
        : undefined,
      extra_cost: Number.isFinite(Number(remote?.extra_cost))
        ? Number(remote?.extra_cost)
        : undefined,
    });

    await this.touchSynced(shipment.id);

    /**
     * PUL TEKSHIRUVI — aynan shu yerda, statusni bilgan PAYTDA.
     *
     * Sotilgan posilka Elchi tomonda TERMINAL bo'ladi va boshqa hech qachon
     * so'ralmaydi (`findOpenShipments` terminal statusni chiqarib tashlaydi).
     * Ya'ni tekshirish uchun BITTA imkon bor — o'sha ham hozir.
     */
    const moneyIssue = await this.verifyMoney(shipment, remote);
    if (moneyIssue) {
      await this.flagMismatch(shipment.id, moneyIssue);
      this.logger.error(
        `ELCHI PUL NOMUVOFIQLIGI: order=${shipment.order_id} — ${moneyIssue}`,
      );
      return 'mismatch';
    }

    if (outcome.note && /nomuvofiq/i.test(outcome.message)) return 'mismatch';
    if (outcome.status === 'success') return 'applied';
    return 'unchanged';
  }

  /**
   * Elchi bilan PUL SHARTLARINI solishtiradi. Nomuvofiqlik matnini qaytaradi,
   * hammasi joyida bo'lsa `null`.
   *
   * NEGA KERAK. Bizda buyurtma sotilganda kuryer kassasiga
   * `total_price − PCS'dagi_Elchi_tarifi` yozildi. Elchi esa o'z bazasida
   * `total_price − O'ZINING_tarifi` ni bizga qarz deb yozadi. Ikki tarif
   * ajralsa (masalan Elchi narxini oshirdi, bizga aytmadi) — biz kutgan
   * summa kelmaydi va farq HAR BUYURTMADA jimgina yo'qoladi. Hech qaysi
   * ekranda ko'rinmaydi, chunki ikkala tomon ham o'zicha "to'g'ri" hisoblaydi.
   *
   * IKKI TEKSHIRUV:
   *   A) Narx: Elchi'dagi `total_price` biz yuborgan summa bilan teng bo'lsin.
   *      Farq bo'lsa kimdir Elchi tomonda narxni o'zgartirgan.
   *   B) Tarif: Elchi ushlab qolgan summa (`total_price − to_be_paid`) bizdagi
   *      vakil-kuryer tarifi bilan teng bo'lsin.
   *
   * ⚠️ Faqat SOTILGAN posilkada ishlaydi. Sotuvgacha `to_be_paid` to'liq COD
   * ga teng (tarif hali ushlanmagan), shuning uchun (B) ni qo'llash SOXTA
   * nomuvofiqlik berardi.
   */
  private async verifyMoney(
    shipment: ElchiShipmentEntity,
    remote: ElchiShipmentStatusResponse | null,
  ): Promise<string | null> {
    if (!remote) return null;
    if (
      !SOLD_ELCHI_STATUSES.includes(normalizeElchiStatus(remote.status ?? ''))
    )
      return null;

    const order = await this.orderRepo.findOne({
      where: { id: shipment.order_id },
      select: ['id', 'order_number', 'total_price', 'where_deliver'],
    });
    if (!order) return null;

    const sent = Number(shipment.cod_amount_sent ?? 0);

    /**
     * --- A) Bizning daftarimiz Elchi narxini AKS ETTIRADIMI ---
     *
     * ⚠️ Solishtiruv `cod_amount_sent` (jo'natishda yuborilgan summa) bilan
     * EMAS, buyurtmaning HOZIRGI narxi bilan. Sababi: Elchi narxni
     * o'zgartirsa (500 000 -> 450 000) biz endi uni QABUL QILAMIZ va
     * `total_price`ni yangilaymiz. Eski summa bilan solishtirsak, har bir
     * qabul qilingan o'zgarish SOXTA nomuvofiqlik bo'lib chiqardi.
     *
     * Ya'ni bu tekshiruv endi boshqa savolga javob beradi: narx o'zgarishi
     * bizda QO'LLANDIMI? Qo'llanmagan bo'lsa (masalan buyurtma allaqachon
     * sotilgan edi va narx yangilanmadi) — farq qoladi va belgilanadi.
     */
    const bookedPrice = Number(order.total_price ?? 0);
    const remoteTotal = Number(remote.total_price ?? NaN);
    if (
      Number.isFinite(remoteTotal) &&
      Math.abs(remoteTotal - bookedPrice) > 0.01
    ) {
      return (
        `narx farqi: bizda ${bookedPrice}, Elchi'da ${remoteTotal} ` +
        `(#${order.order_number}, jo'natishda ${sent} edi) — narx ` +
        `o'zgarishi qo'llanmagan`
      );
    }

    // --- B) Tarif tengmi ---
    const remoteOwed = Number(remote.cod_amount ?? NaN);
    if (!Number.isFinite(remoteOwed)) return null;

    // Tarif farqini HOZIRGI narx ustida hisoblaymiz: narx o'zgarishi
    // qabul qilingandan keyin kassaga aynan shu narx bo'yicha yozilgan.
    const base = Number.isFinite(remoteTotal) ? remoteTotal : bookedPrice;
    const elchiKept = base - remoteOwed;

    const expectedTariff = await this.expectedElchiTariff(order.where_deliver);
    if (expectedTariff == null) return null;

    if (Math.abs(elchiKept - expectedTariff) > 0.01) {
      return (
        `tarif farqi: Elchi ${elchiKept} ushlab qoldi, bizda tarif ` +
        `${expectedTariff} (#${order.order_number}) — kuryer kassasiga ` +
        `${base - expectedTariff} yozilgan, Elchi ${remoteOwed} qarzdor`
      );
    }

    return null;
  }

  /**
   * Vakil-kuryerning shu yetkazish turi uchun tarifi.
   *
   * Sotuv paytida kuryer kassasiga aynan shu tarif ayirilib yozilgan, shuning
   * uchun solishtiruv ham shunga tayanishi kerak. Kuryer yoki tarif yo'q
   * bo'lsa `null` — tekshiruv o'tkazib yuboriladi (soxta nomuvofiqlik
   * berishdan ko'ra jim qolish yaxshi).
   */
  private async expectedElchiTariff(
    whereDeliver: Where_deliver | null,
  ): Promise<number | null> {
    const config = await this.configRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (!config?.elchi_courier_user_id) return null;

    const courier = await this.userRepo.findOne({
      where: { id: config.elchi_courier_user_id },
      select: ['id', 'tariff_home', 'tariff_center'],
    });
    if (!courier) return null;

    const raw =
      whereDeliver === Where_deliver.CENTER
        ? courier.tariff_center
        : courier.tariff_home;
    const tariff = Number(raw ?? NaN);
    return Number.isFinite(tariff) ? tariff : null;
  }

  /** Nomuvofiqlikni posilkaga yozadi — admin paneldagi filtr shu maydonlarni o'qiydi. */
  private async flagMismatch(
    shipmentId: string,
    reason: string,
  ): Promise<void> {
    await this.shipmentRepo.update(
      { id: shipmentId },
      { mismatch_at: Date.now(), mismatch_reason: reason },
    );
  }

  /**
   * "Tekshirildi" belgisini yangilaydi — status o'zgarmasa ham.
   *
   * Bu aylanishning YURAGI: aks holda tartib o'zgarmay, ayni posilkalar
   * qayta-qayta tekshirilib, boshqalari navbatga hech qachon kelmasdi.
   */
  private async touchSynced(shipmentId: string): Promise<void> {
    await this.shipmentRepo.update(
      { id: shipmentId },
      { last_synced_at: Date.now() },
    );
  }
}
