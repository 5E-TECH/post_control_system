import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceOutboxEntity } from 'src/core/entity/marketplace-outbox.entity';
import { MarketplaceParcelEntity } from 'src/core/entity/marketplace-parcel.entity';
import { MarketplaceApiService } from './marketplace-api.service';
import { MarketplaceLedgerService } from './marketplace-ledger.service';
import {
  MarketplaceAggregateType,
  MarketplaceEventType,
  MarketplaceOutboxStatus,
  MarketplaceParcelStatus,
  MarketplaceScanState,
} from './marketplace.enums';
import { buildEventEnvelope } from './utils/marketplace-event.util';

/** Bir siklda nechta posilka solishtiriladi. */
const BATCH = 100;

/**
 * Terminal holatlar — bular uchun solishtiruv KERAK EMAS.
 * ⚠️ `DELIVERED` va `CANCELLED` ham terminal, LEKIN rollback ularni
 * qaytarishi mumkin. Shu bois ular ro'yxatda YO'Q: rollback'dan keyingi
 * holat ham tekshirilishi kerak.
 */
const TERMINAL_REMOTE = new Set<string>([
  MarketplaceParcelStatus.RETURNED,
  MarketplaceParcelStatus.VOIDED,
  MarketplaceParcelStatus.REJECTED_BY_BEEPOST,
]);

/**
 * SOLISHTIRUV — ikki tizim ajralib ketmasligining oxirgi himoyasi.
 *
 * ⚠️ NEGA KERAK. Kontraktda yetkazish kafolati halol yozilgan: hodisalar
 * **kamida bir marta** yuboriladi va **yo'qolishi ham mumkin**. Outbox
 * buni kamaytiradi, lekin nolga tushirmaydi:
 *
 *   · 8 urinish ~7.75 soatda tugaydi — marketplace undan uzoq o'chsa,
 *     hodisa `failed` bo'lib qoladi;
 *   · ular `200` qaytarib, ichkarida qo'llamasligi mumkin;
 *   · bizning daftarimiz kassadan ajralib qolishi mumkin (ilgak
 *     qo'yilmagan kassa nuqtasi yoki qo'lda SQL).
 *
 * Bu servis har uchala holatni ham TOPADI.
 */
@Injectable()
export class MarketplaceReconcileService {
  private readonly logger = new Logger(MarketplaceReconcileService.name);
  private running = false;

  constructor(
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
    @InjectRepository(MarketplaceParcelEntity)
    private readonly parcelRepo: Repository<MarketplaceParcelEntity>,
    @InjectRepository(MarketplaceOutboxEntity)
    private readonly outboxRepo: Repository<MarketplaceOutboxEntity>,
    private readonly api: MarketplaceApiService,
    private readonly ledger: MarketplaceLedgerService,
  ) {}

  // ═══════════════════ POSILKA SOLISHTIRUVI ═══════════════════

  @Cron('0 */15 * * * *', { timeZone: 'Asia/Tashkent' })
  async reconcileParcelsCron(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const integrations = await this.integrationRepo.find({
        where: { is_active: true },
      });
      for (const integration of integrations) {
        await this.reconcileParcels(integration).catch((e) =>
          this.logger.error(
            `solishtiruv xatosi (${integration.slug}): ${e instanceof Error ? e.message : e}`,
          ),
        );
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Ochiq posilkalarni ularning holati bilan solishtiradi.
   *
   * ⚠️ `last_synced_at ASC NULLS FIRST` tartibi — hech qachon
   * solishtirilmagan posilkalar birinchi navbatda. Aks holda eski
   * posilkalar doim oxirida qolib, hech qachon tekshirilmasdi.
   */
  async reconcileParcels(integration: MarketplaceIntegrationEntity) {
    const parcels = await this.parcelRepo
      .createQueryBuilder('p')
      .where('p.integration_id = :iid', { iid: integration.id })
      .andWhere('p.scan_state = :accepted', {
        accepted: MarketplaceScanState.ACCEPTED,
      })
      .andWhere(
        '(p.remote_status IS NULL OR p.remote_status NOT IN (:...terminal))',
        { terminal: [...TERMINAL_REMOTE] },
      )
      .orderBy('p.last_synced_at', 'ASC', 'NULLS FIRST')
      .take(BATCH)
      .getMany();

    if (parcels.length === 0) return { checked: 0, mismatches: 0, requeued: 0 };

    const byExternalId = new Map(parcels.map((p) => [p.external_parcel_id, p]));
    const remote = await this.api.fetchParcelStatuses(integration, {
      ids: [...byExternalId.keys()],
    });

    let mismatches = 0;
    let requeued = 0;
    const now = Date.now();
    const seen = new Set<string>();

    for (const item of remote.items ?? []) {
      const parcel = byExternalId.get(item.external_parcel_id);
      if (!parcel) continue;
      seen.add(item.external_parcel_id);

      const problems: string[] = [];

      // ── 1. SEQ UZILISHI — eng muhim tekshiruv ──
      // Ular bizdan orqada qolgan bo'lsa, hodisalar yetib bormagan.
      const theirSeq = Number(item.last_applied_seq ?? 0);
      const ourSeq = Number(parcel.last_sent_seq);
      if (theirSeq < ourSeq) {
        problems.push(`seq orqada: ularda ${theirSeq}, bizda ${ourSeq}`);
        requeued += await this.requeueMissingEvents(parcel.id, theirSeq);
      }

      // ── 2. STATUS MOS KELMASLIGI ──
      if (
        parcel.remote_status &&
        item.status &&
        item.status !== parcel.remote_status
      ) {
        problems.push(
          `status farq: ularda «${item.status}», bizda «${parcel.remote_status}»`,
        );
      }

      if (problems.length > 0) {
        mismatches++;
        parcel.mismatch_at = now;
        parcel.mismatch_reason = problems.join(' · ');
        this.logger.warn(
          `⚠️ nomuvofiqlik ${parcel.external_parcel_id}: ${parcel.mismatch_reason}`,
        );
      } else if (parcel.mismatch_at) {
        // O'z-o'zidan tuzalgan — belgini olib tashlaymiz.
        parcel.mismatch_at = null;
        parcel.mismatch_reason = null;
      }

      parcel.last_synced_at = now;
      await this.parcelRepo.save(parcel);
    }

    // ── 3. ULARDA UMUMAN YO'Q POSILKALAR ──
    // Biz qabul qilganmiz, ular bilmaydi — qabul hodisasi yetib bormagan
    // yoki ular yozuvni yo'qotgan.
    for (const [extId, parcel] of byExternalId) {
      if (seen.has(extId)) continue;
      mismatches++;
      parcel.mismatch_at = now;
      parcel.mismatch_reason = 'Marketplace javobida bu posilka YO\'Q';
      parcel.last_synced_at = now;
      await this.parcelRepo.save(parcel);
      requeued += await this.requeueMissingEvents(parcel.id, 0);
      this.logger.warn(`⚠️ ularda topilmadi: ${extId}`);
    }

    if (mismatches > 0 || requeued > 0) {
      this.logger.log(
        `🔍 ${integration.slug}: ${parcels.length} tekshirildi, ` +
          `${mismatches} nomuvofiqlik, ${requeued} hodisa qayta navbatga qo'yildi`,
      );
    }
    return { checked: parcels.length, mismatches, requeued };
  }

  /**
   * Yetib bormagan hodisalarni QAYTA NAVBATGA qo'yadi.
   *
   * ⚠️ Xavfsiz: hodisalar `event_id` bo'yicha idempotent, ya'ni ular
   * allaqachon qo'llagan bo'lsa `applied: false` qaytaradi. Qayta
   * yuborish zarar keltirmaydi, yubormaslik esa jimgina desinxronizatsiya.
   *
   * ⚠️ `superseded` qatorlar TEGILMAYDI — ular ataylab yuborilmagan.
   */
  private async requeueMissingEvents(
    parcelId: string,
    fromSeq: number,
  ): Promise<number> {
    const res = await this.outboxRepo
      .createQueryBuilder()
      .update(MarketplaceOutboxEntity)
      .set({
        status: MarketplaceOutboxStatus.PENDING,
        attempts: 0,
        next_retry_at: Date.now(),
        status_reason: 'Solishtiruv: marketplace bu hodisani qo\'llamagan',
        updated_at: Date.now(),
      })
      .where('aggregate_type = :t', { t: MarketplaceAggregateType.PARCEL })
      .andWhere('aggregate_id = :id', { id: parcelId })
      .andWhere('seq > :seq', { seq: fromSeq })
      .andWhere('status IN (:...st)', {
        st: [MarketplaceOutboxStatus.SENT, MarketplaceOutboxStatus.FAILED],
      })
      .execute();
    return res.affected ?? 0;
  }

  // ═══════════════════ DAFTAR SOLISHTIRUVI ═══════════════════

  @Cron('0 30 3 * * *', { timeZone: 'Asia/Tashkent' })
  async reconcileLedgerCron(): Promise<void> {
    const integrations = await this.integrationRepo.find({
      where: { is_active: true },
    });
    for (const integration of integrations) {
      await this.reconcileLedger(integration).catch((e) =>
        this.logger.error(
          `daftar solishtiruvi xatosi (${integration.slug}): ${e instanceof Error ? e.message : e}`,
        ),
      );
    }
  }

  /**
   * Kunlik daftar tekshiruvi — UCH qatlam.
   *
   *   1. ICHKI invariant: `SUM(daftar) == market kassasi balansi`.
   *      Buzilsa — daftar yozuvi tushib qolgan (ilgak qo'yilmagan kassa
   *      nuqtasi) yoki kassa daftarsiz o'zgartirilgan (qo'lda SQL).
   *   2. TASHQI solishtiruv: ularning balansi bizникiga teng emasmi.
   *   3. `ledger.snapshot` hodisasi — ular o'zini tekshirib olsin.
   */
  async reconcileLedger(integration: MarketplaceIntegrationEntity) {
    const invariant = await this.ledger.verifyInvariant(integration.id);
    if (!invariant.ok) {
      // ⚠️ Bu JIDDIY: daftar va kassa ajralgan. Avtomatik tuzatilmaydi —
      // qaysi tomoni to'g'ri ekanini faqat odam aniqlay oladi.
      this.logger.error(
        `🔴 ${integration.slug}: DAFTAR INVARIANTI BUZILGAN — ` +
          `daftar ${invariant.ledger_sum}, kassa ${invariant.cashbox_balance}, ` +
          `farq ${invariant.diff}`,
      );
    }

    const sellers = await this.ledger.balancesBySeller(integration.id);

    let remoteBalance: number | null = null;
    let remoteDiff: number | null = null;
    try {
      const remote = await this.api.fetchLedgerBalance(integration);
      remoteBalance = Number(remote.total_receivable ?? 0);
      remoteDiff = invariant.cashbox_balance - remoteBalance;
      if (remoteDiff !== 0) {
        this.logger.warn(
          `⚠️ ${integration.slug}: daftar farqi — bizda ${invariant.cashbox_balance}, ` +
            `ularda ${remoteBalance} (farq ${remoteDiff})`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `${integration.slug}: ularning balansi olinmadi — ${e instanceof Error ? e.message : e}`,
      );
    }

    await this.emitSnapshot(integration, invariant.cashbox_balance, sellers);
    await this.integrationRepo.update(
      { id: integration.id },
      { last_reconcile_at: Date.now(), updated_at: Date.now() },
    );

    return { invariant, remote_balance: remoteBalance, diff: remoteDiff, sellers };
  }

  /**
   * `ledger.snapshot` — kunlik to'liq holat.
   *
   * ⚠️ Bu uchinchi himoya qatlami: `balance_after` bitta yo'qolgan hodisani
   * tuzatadi, `seq` uzilishi qaysi biri yo'qolganini aytadi, snapshot esa
   * ikkalasi ham yiqilgan holatni ushlaydi.
   */
  private async emitSnapshot(
    integration: MarketplaceIntegrationEntity,
    balance: number,
    sellers: Array<{ seller_id: string | null; balance: number }>,
  ): Promise<void> {
    const rows: Array<{ next_ledger_seq: string }> =
      await this.integrationRepo.query(
        `UPDATE "marketplace_integration"
            SET "next_ledger_seq" = "next_ledger_seq" + 1, "updated_at" = $2
          WHERE "id" = $1
          RETURNING "next_ledger_seq"`,
        [integration.id, Date.now()],
      );
    const seq = Number(rows[0].next_ledger_seq);
    const eventId = randomUUID();

    const payload = buildEventEnvelope({
      event_id: eventId,
      seq,
      event_type: MarketplaceEventType.LEDGER_SNAPSHOT,
      occurred_at: Date.now(),
      integration_slug: integration.slug,
      parcel: { external_parcel_id: '', external_order_id: '', seller_id: null },
    });
    delete (payload as Record<string, unknown>).parcel;
    (payload as Record<string, unknown>).snapshot = {
      currency: 'UZS',
      balance,
      sellers: sellers
        .filter((s) => s.seller_id)
        .map((s) => ({ seller_id: s.seller_id, balance: s.balance })),
    };

    await this.outboxRepo.save(
      this.outboxRepo.create({
        integration_id: integration.id,
        event_id: eventId,
        event_type: MarketplaceEventType.LEDGER_SNAPSHOT,
        aggregate_type: MarketplaceAggregateType.LEDGER,
        aggregate_id: integration.id,
        seq,
        payload,
        attempts: 0,
        next_retry_at: Date.now(),
      }),
    );
  }

  // ═══════════════════ PANEL UCHUN ═══════════════════

  /** Nomuvofiqlik kartasi — admin panelida ko'rinadi. */
  async listMismatches(integrationId: string, limit = 50) {
    return this.parcelRepo.find({
      where: { integration_id: integrationId, mismatch_at: Not(IsNull()) },
      order: { mismatch_at: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  /** Operator nomuvofiqlikni hal qildi — belgini olib tashlash. */
  async clearMismatch(parcelId: string) {
    await this.parcelRepo.update(
      { id: parcelId },
      { mismatch_at: null, mismatch_reason: null, updated_at: Date.now() },
    );
    return { ok: true };
  }
}
