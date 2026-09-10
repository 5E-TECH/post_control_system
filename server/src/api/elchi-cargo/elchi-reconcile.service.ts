import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ElchiConfigEntity } from 'src/core/entity/elchi-config.entity';
import { ElchiShipmentEntity } from 'src/core/entity/elchi-shipment.entity';
import { ElchiApiService } from './elchi-api.service';
import { ElchiWebhookService } from './elchi-webhook.service';
import { normalizeElchiStatus } from './utils/elchi-status.mapper';

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
    return this.shipmentRepo
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
      .getMany();
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

    // ⚠️ `cod_collected` ATAYLAB YUBORILMAYDI. `GET /partner/shipments/:id`
    // javobidagi `cod_amount` — bu `to_be_paid` (to'lanishi kerak summa),
    // webhookdagi `paid_amount` (yig'ilgan) EMAS. Ikkisini aralashtirish
    // pul solishtiruvini buzardi. Yig'ilgan summa faqat webhookdan yoziladi.
    const outcome = await this.webhookService.applyStatusUpdate(config, {
      event: 'shipment.status_changed',
      external_order_id: shipment.order_id,
      shipment_id: shipment.elchi_shipment_id ?? undefined,
      status: remoteStatus,
    });

    await this.touchSynced(shipment.id);

    if (outcome.note && /nomuvofiq/i.test(outcome.message)) return 'mismatch';
    if (outcome.status === 'success') return 'applied';
    return 'unchanged';
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
