import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Cashbox_type, Operation_type, Source_type } from 'src/common/enums';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { applyCashboxDelta } from 'src/common/database/cashbox-delta.util';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceSettlementEntity } from 'src/core/entity/marketplace-settlement.entity';
import { MarketplaceLedgerService } from './marketplace-ledger.service';
import { MarketplaceOutboxService } from './marketplace-outbox.service';
import {
  MarketplaceAggregateType,
  MarketplaceEventType,
  MarketplaceLedgerEntryType,
  MarketplaceSettlementMethod,
} from './marketplace.enums';
import { buildEventEnvelope } from './utils/marketplace-event.util';
import { MarketplaceOutboxEntity } from 'src/core/entity/marketplace-outbox.entity';

export interface SettlementInput {
  amount: number;
  method: MarketplaceSettlementMethod;
  allocation: Array<{ seller_id: string; amount: number }>;
  reference?: string | null;
  note?: string | null;
}

/**
 * MARKETPLACE'GA TO'LOV (hisob-kitob) — pul halqasini YOPADI.
 *
 * ⚠️ NEGA MAVJUD `paymentsToMarket` YARAMAYDI. U to'lovni market bo'yicha
 * ENG ESKI buyurtmalardan boshlab FIFO tarqatadi va ularni `SOLD → PAID`
 * qiladi. 40 sotuvchili marketda bu degani: **A sotuvchi uchun berilgan pul
 * C, D va E sotuvchilarining buyurtmalarini «to'langan» qilib qo'yadi**.
 * Marketplace bizning `PAID` bayrog'imizga qarab to'lasa — noto'g'ri
 * odamga to'laydi. Shu bois u yo'l marketplace marketi uchun bloklangan.
 *
 * ⚠️ `settlement.paid` — marketplace uchun sotuvchiga to'lash signali
 * BERADIGAN YAGONA hodisa. Buyurtma statusi (`PAID`) EMAS: PCS'da market
 * balansi manfiy bo'lsa sotuv avtomatik eski qarzni yopadi va status `PAID`
 * bo'ladi — hech qanday pul harakat qilmagan holda.
 */
@Injectable()
export class MarketplaceSettlementService {
  private readonly logger = new Logger(MarketplaceSettlementService.name);

  constructor(
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
    @InjectRepository(MarketplaceSettlementEntity)
    private readonly settlementRepo: Repository<MarketplaceSettlementEntity>,
    private readonly dataSource: DataSource,
    private readonly ledger: MarketplaceLedgerService,
    private readonly outbox: MarketplaceOutboxService,
  ) {}

  /**
   * To'lovni amalga oshiradi.
   *
   * Bitta tranzaksiyada: asosiy kassadan chiqim → marketplace market
   * kassasidan chiqim → daftar yozuvi → `settlement.paid` hodisasi.
   */
  async pay(slug: string, input: SettlementInput, user: JwtPayload) {
    const integration = await this.integrationRepo.findOne({ where: { slug } });
    if (!integration) {
      throw new NotFoundException(`Marketplace ulanishi topilmadi: ${slug}`);
    }

    const amount = Math.trunc(Number(input.amount) || 0);
    if (amount <= 0) {
      throw new BadRequestException("To'lov summasi musbat bo'lishi shart");
    }

    // ⚠️ TAQSIMOT YIG'INDISI SUMMAGA TENG BO'LISHI SHART.
    // Aks holda marketplace sotuvchilarga noto'g'ri taqsimlaydi va farq
    // hech qayerda ko'rinmaydi — bu eng yomon turdagi xato.
    const allocation = (input.allocation ?? []).map((a) => ({
      seller_id: String(a.seller_id),
      amount: Math.trunc(Number(a.amount) || 0),
    }));
    const allocSum = allocation.reduce((n, a) => n + a.amount, 0);
    if (allocation.length === 0) {
      throw new BadRequestException(
        "Sotuvchilar bo'yicha taqsimot ko'rsatilishi shart — " +
          "marketplace kimga qancha berishni shundan biladi",
      );
    }
    if (allocSum !== amount) {
      throw new BadRequestException(
        `Taqsimot yig'indisi (${allocSum.toLocaleString('uz-UZ')}) ` +
          `to'lov summasiga (${amount.toLocaleString('uz-UZ')}) teng emas`,
      );
    }
    if (allocation.some((a) => a.amount <= 0)) {
      throw new BadRequestException(
        "Taqsimotdagi har bir summa musbat bo'lishi shart",
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const mainCashbox = await qr.manager.findOne(CashEntity, {
        where: { cashbox_type: Cashbox_type.MAIN },
      });
      if (!mainCashbox) throw new NotFoundException('Asosiy kassa topilmadi');

      const marketCashbox = await qr.manager.findOne(CashEntity, {
        where: {
          user_id: integration.market_id,
          cashbox_type: Cashbox_type.FOR_MARKET,
        },
      });
      if (!marketCashbox) {
        throw new NotFoundException('Marketplace marketi kassasi topilmadi');
      }

      const comment =
        input.note ??
        `«${integration.name}» marketplace bilan hisob-kitob` +
          (input.reference ? ` (${input.reference})` : '');

      // ── 1. Asosiy kassadan chiqim ──
      // ⚠️ `balance_cash`/`balance_card` ajratimi bu yerda YURITILMAYDI —
      // u alohida ish (MAIN kassa kartalar invariantiga bog'langan).
      await applyCashboxDelta(qr.manager, {
        cashbox: mainCashbox,
        delta: -amount,
        operation: Operation_type.EXPENSE,
        source_type: Source_type.MARKET_PAYMENT,
        amount,
        source_user_id: integration.market_id,
        comment,
        created_by: user.id,
      });

      // ── 2. Marketplace market kassasidan chiqim (qarz kamayadi) ──
      const marketWrite = await applyCashboxDelta(qr.manager, {
        cashbox: marketCashbox,
        delta: -amount,
        operation: Operation_type.EXPENSE,
        source_type: Source_type.MARKET_PAYMENT,
        amount,
        comment,
        created_by: user.id,
      });

      // ── 3. Hisob-kitob yozuvi ──
      const settlement = await qr.manager.save(
        qr.manager.create(MarketplaceSettlementEntity, {
          integration_id: integration.id,
          amount,
          method: input.method,
          allocation,
          reference: input.reference ?? null,
          cashbox_history_id: marketWrite.history_id,
          created_by: user.id,
          paid_at: Date.now(),
          note: input.note ?? null,
        }),
      );

      // ── 4. Daftar: BITTA umumiy yozuv ──
      // ⚠️ Har sotuvchiga alohida yozuv YOZILMAYDI. Sabab: kassada BITTA
      // chiqim bor, daftar esa kassaga teng bo'lishi shart
      // (`SUM(daftar) == cash_box.balance`). Sotuvchilar bo'yicha taqsimot
      // `allocation` da saqlanadi va hodisada yuboriladi.
      const entry = await this.ledger.appendEntry(qr.manager, {
        integration_id: integration.id,
        entry_type: MarketplaceLedgerEntryType.SETTLEMENT,
        amount: -amount,
        cashbox_history_id: marketWrite.history_id,
        note: comment,
      });

      // ── 5. Hodisa ──
      const eventId = randomUUID();
      const seqRows: Array<{ next_ledger_seq: string }> = await qr.manager.query(
        `UPDATE "marketplace_integration"
            SET "next_ledger_seq" = "next_ledger_seq" + 1, "updated_at" = $2
          WHERE "id" = $1
          RETURNING "next_ledger_seq"`,
        [integration.id, Date.now()],
      );
      const seq = Number(seqRows[0].next_ledger_seq);

      const payload = buildEventEnvelope({
        event_id: eventId,
        seq,
        event_type: MarketplaceEventType.SETTLEMENT_PAID,
        occurred_at: Date.now(),
        integration_slug: integration.slug,
        // Hisob-kitob posilkaga bog'liq emas — bo'sh identifikatorlar.
        parcel: {
          external_parcel_id: '',
          external_order_id: '',
          seller_id: null,
        },
        ledger: { entry_id: entry.id, balance_after: entry.balance_after },
        actor: { type: 'admin' },
        note: comment,
      });
      // `parcel` bo'limi bu hodisada ma'nosiz — olib tashlaymiz.
      delete (payload as Record<string, unknown>).parcel;
      (payload as Record<string, unknown>).settlement = {
        settlement_id: settlement.id,
        amount,
        method: input.method,
        paid_at: settlement.paid_at,
        reference: input.reference ?? null,
        allocation,
      };

      await qr.manager.save(
        qr.manager.create(MarketplaceOutboxEntity, {
          integration_id: integration.id,
          event_id: eventId,
          event_type: MarketplaceEventType.SETTLEMENT_PAID,
          aggregate_type: MarketplaceAggregateType.SETTLEMENT,
          aggregate_id: settlement.id,
          seq,
          payload,
          attempts: 0,
          next_retry_at: Date.now(),
        }),
      );

      await qr.manager.update(
        MarketplaceIntegrationEntity,
        { id: integration.id },
        { last_settlement_at: Date.now(), updated_at: Date.now() },
      );

      await qr.commitTransaction();

      this.logger.log(
        `💸 hisob-kitob: ${amount.toLocaleString('uz-UZ')} so'm, ` +
          `${allocation.length} sotuvchi, balans ${entry.balance_after}`,
      );

      return {
        settlement_id: settlement.id,
        amount,
        allocation,
        balance_after: entry.balance_after,
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /**
   * To'lov ekrani uchun taklif: har sotuvchining joriy qoldig'i.
   *
   * ⚠️ Faqat MUSBAT qoldiqlar taklif qilinadi — manfiy qoldiq (prepaid
   * posilkalar sabab) sotuvchining BIZGA qarzi, unga to'lash noto'g'ri.
   */
  async suggestAllocation(slug: string) {
    const integration = await this.integrationRepo.findOne({ where: { slug } });
    if (!integration) {
      throw new NotFoundException(`Marketplace ulanishi topilmadi: ${slug}`);
    }

    const balances = await this.ledger.balancesBySeller(integration.id);
    const payable = balances.filter((b) => b.seller_id && b.balance > 0);
    const invariant = await this.ledger.verifyInvariant(integration.id);

    return {
      integration: { slug: integration.slug, name: integration.name },
      total_payable: payable.reduce((n, b) => n + b.balance, 0),
      sellers: payable.map((b) => ({
        seller_id: b.seller_id,
        amount: b.balance,
        entries: b.entries,
      })),
      // Qoldig'i MANFIY sotuvchilar — ular BIZGA qarzdor (prepaid).
      negative_sellers: balances.filter((b) => b.seller_id && b.balance < 0),
      invariant,
    };
  }
}
