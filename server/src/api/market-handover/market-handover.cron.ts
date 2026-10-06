import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { MarketReturnHandoverSessionEntity } from 'src/core/entity/market-return-handover-session.entity';
import { Group_type } from 'src/common/enums';
import { findMarketGroup } from 'src/common/utils/telegram-group.util';
import { awaitingMarketSql } from 'src/common/utils/cancel-return.util';
import { BotService } from '../bots/notify-bot/bot.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  MarketHandoverCloseReason,
  MarketHandoverSessionStatus,
  MARKET_HANDOVER_HEARTBEAT_GRACE_MS,
} from './market-handover.enums';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Marketga «olib keting» eslatmasi — 3 kundan keyin. */
const REMIND_AFTER_MS = 3 * DAY_MS;

/** Admin navbatiga eskalatsiya — 7 kundan keyin. */
const ESCALATE_AFTER_MS = 7 * DAY_MS;

/** «Ombor muddati o'tdi» — 14 kundan keyin ovozli ogohlantirish. */
const OVERDUE_AFTER_MS = 14 * DAY_MS;

/** Bir tikda eng ko'pi shuncha qator — ulkan navbatda ham tik qotmaydi. */
const BATCH = 500;

/**
 * BEKOR QAYTARISH — rejali ishlar.
 *
 * ⚠️ AVTO-YOPISH YO'Q (qulflangan mahsulot qarori).
 *
 * Posilka marketga topshirilgani — JISMONIY fakt. Agar cron 14 kundan keyin
 * uni «topshirildi» deb yopsa, tizim YOLG'ON gapiradi: mol hali omborda
 * turadi va market hech narsa olmagan. Shuning uchun bu cron faqat
 * MAJBURLOVCHI KUCH beradi:
 *
 *   D+3   marketga eslatma (Telegram CANCEL guruhi) + `handover_notified_at`
 *   D+7   `handover_escalated_at` → admin navbatida qizil bo'lib ko'rinadi
 *   D+14  ovozli `logger.warn` + hisobotda «ombor muddati o'tdi» bucketi
 *
 * Statusni faqat ODAM o'zgartiradi: market ruxsati yoki offline akt.
 * Bu invariant testda qulflangan.
 *
 * Hajm o'lchovi: kuniga ~150 qaytarish, navbatda doimiy 450–2 100 posilka —
 * shuning uchun har tik partiyalab ishlaydi va qismiy indeksdan foydalanadi.
 */
@Injectable()
export class MarketHandoverCron {
  private readonly logger = new Logger(MarketHandoverCron.name);

  /**
   * ⚠️ Bir vaqtda faqat bitta ishlash. `@Cron` oldingi tikni kutmaydi —
   * sekin tarmoq (Telegram) tufayli ikki tik bir-biriga mindirsa ayni
   * marketga ikki eslatma ketardi.
   */
  private reminding = false;
  private escalating = false;
  private sweepingSessions = false;

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(MarketReturnHandoverSessionEntity)
    private readonly sessionRepo: Repository<MarketReturnHandoverSessionEntity>,
    private readonly dataSource: DataSource,
    private readonly botService: BotService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * D+3 — MARKETGA ESLATMA.
   *
   * Kuniga bir marta (ertalab 09:10). Soatiga emas: eslatma spam bo'lsa
   * market guruhni o'chiradi va keyin HECH QANDAY xabar yetmaydi.
   *
   * ⚠️ IDEMPOTENT: `handover_notified_at IS NULL` sharti + yozuv. Aks holda
   * posilka marketda olinmagancha har kuni xabar ketardi.
   */
  @Cron('0 10 9 * * *', { timeZone: 'Asia/Tashkent' })
  async remindMarkets(): Promise<void> {
    if (this.reminding) return;
    this.reminding = true;
    try {
      const threshold = Date.now() - REMIND_AFTER_MS;
      const rows = await this.orderRepo
        .createQueryBuilder('o')
        .where(awaitingMarketSql('o'))
        .andWhere('o.handover_notified_at IS NULL')
        .andWhere('o.center_received_at <= :threshold', { threshold })
        .select(['o.id', 'o.user_id', 'o.center_received_at'])
        .limit(BATCH)
        .getMany();

      if (!rows.length) return;

      // Market bo'yicha guruhlaymiz: posilka-posilka xabar yuborish
      // guruhni ko'mib tashlardi (kuniga ~150 qaytarish).
      const byMarket = new Map<string, { ids: string[]; oldest: number }>();
      for (const o of rows) {
        const entry = byMarket.get(o.user_id) ?? {
          ids: [],
          oldest: Number(o.center_received_at ?? 0),
        };
        entry.ids.push(o.id);
        entry.oldest = Math.min(
          entry.oldest,
          Number(o.center_received_at ?? 0),
        );
        byMarket.set(o.user_id, entry);
      }

      for (const [marketId, entry] of byMarket) {
        const days = Math.floor((Date.now() - entry.oldest) / DAY_MS);
        try {
          const group = await findMarketGroup(
            this.dataSource.manager,
            marketId,
            Group_type.CANCEL,
          );
          await this.botService.sendMessageToGroup(
            group?.group_id || null,
            `*⏳ Qaytarishlaringiz markazda kutmoqda*\n\n` +
              `${entry.ids.length} ta bekor qilingan buyurtma markazda turibdi ` +
              `(eng keksasi ${days} kun).\n\n` +
              `Kabinetdagi *«Qaytarilgan buyurtmalar»* bo'limidan topshirishga ` +
              `ruxsat berib, posilkalarni olib keting.`,
          );
        } catch {
          // Telegram yetmasa ham BELGI qo'yiladi: aks holda ertaga yana
          // urinib, market hech qachon "eslatilgan" bo'lmasdi va eskalatsiya
          // hisobi ham siljib ketardi.
        }

        await this.orderRepo.update(
          { id: In(entry.ids), handover_notified_at: IsNull() },
          { handover_notified_at: Date.now() },
        );
      }

      this.logger.log(
        `Bekor qaytarish eslatmasi: ${byMarket.size} market, ${rows.length} posilka`,
      );
    } catch (error) {
      this.logger.error(
        `remindMarkets xato: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.reminding = false;
    }
  }

  /**
   * D+7 ESKALATSIYA va D+14 OGOHLANTIRISH.
   *
   * ⚠️ STATUS O'ZGARMAYDI. Bu yerda faqat belgi qo'yiladi — xodim ekranida
   * qizil «eskalatsiya» bo'lib ko'rinadi va hisobotga tushadi.
   */
  @Cron('0 20 9 * * *', { timeZone: 'Asia/Tashkent' })
  async escalateStale(): Promise<void> {
    if (this.escalating) return;
    this.escalating = true;
    try {
      const now = Date.now();

      const toEscalate = await this.orderRepo
        .createQueryBuilder('o')
        .where(awaitingMarketSql('o'))
        .andWhere('o.handover_escalated_at IS NULL')
        .andWhere('o.center_received_at <= :threshold', {
          threshold: now - ESCALATE_AFTER_MS,
        })
        .select(['o.id', 'o.order_number', 'o.user_id'])
        .limit(BATCH)
        .getMany();

      if (toEscalate.length) {
        await this.orderRepo.update(
          {
            id: In(toEscalate.map((o) => o.id)),
            handover_escalated_at: IsNull(),
          },
          { handover_escalated_at: now },
        );
        for (const o of toEscalate) {
          void this.activityLog.log({
            entity_type: 'order',
            entity_id: o.id,
            action: 'handover_escalated',
            new_value: { handover_escalated_at: now },
            description: `Buyurtma #${o.order_number} markazda 7 kundan beri turibdi — market olib ketmadi`,
            metadata: { market_id: o.user_id },
          });
        }
        this.logger.warn(
          `Bekor qaytarish eskalatsiyasi: ${toEscalate.length} posilka 7 kundan beri markazda`,
        );
      }

      // D+14 — ovozli ogohlantirish. Belgi QO'YILMAYDI (eskalatsiya belgisi
      // yetarli), chunki bu holat hisobotda yosh bo'yicha o'zi ko'rinadi.
      const overdue = await this.orderRepo
        .createQueryBuilder('o')
        .where(awaitingMarketSql('o'))
        .andWhere('o.center_received_at <= :threshold', {
          threshold: now - OVERDUE_AFTER_MS,
        })
        .select('COUNT(*)::int', 'c')
        .addSelect('COUNT(DISTINCT o.user_id)::int', 'm')
        .getRawOne<{ c: number; m: number }>();

      const overdueCount = Number(overdue?.c ?? 0);
      if (overdueCount > 0) {
        this.logger.warn(
          `⚠️ OMBOR MUDDATI: ${overdueCount} posilka 14 kundan beri markazda ` +
            `(${Number(overdue?.m ?? 0)} market) — avto-yopish YO'Q, odam qarori kerak`,
        );
      }
    } catch (error) {
      this.logger.error(
        `escalateStale xato: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.escalating = false;
    }
  }

  /**
   * O'LIK SESSIYALARNI YOPISH.
   *
   * Ruxsat sahifaga bog'langan: `release` chaqirig'i kelmasa (brauzer
   * qulashi, tarmoq uzilishi) sessiya `active` bo'lib qolib ketadi.
   * Topshirish paytida `resolveActiveSession` buni o'zi aniqlaydi va
   * yopadi, LEKIN hech kim qaytib kelmasa qator abadiy "ochiq" turardi va
   * audit yolg'on ko'rinardi ("ruxsat hali ochiq").
   *
   * Har 5 daqiqada: muddati o'tgan yoki heartbeat'i uzilgan sessiyalar
   * yopiladi.
   */
  @Cron('0 */5 * * * *', { timeZone: 'Asia/Tashkent' })
  async closeDeadSessions(): Promise<void> {
    if (this.sweepingSessions) return;
    this.sweepingSessions = true;
    try {
      const now = Date.now();

      const expired = await this.sessionRepo
        .createQueryBuilder()
        .update(MarketReturnHandoverSessionEntity)
        .set({
          status: MarketHandoverSessionStatus.CLOSED,
          closed_at: now,
          close_reason: MarketHandoverCloseReason.EXPIRED,
        })
        .where('status = :active', {
          active: MarketHandoverSessionStatus.ACTIVE,
        })
        .andWhere('authorization_expires_at <= :now', { now })
        .execute();

      const heartbeatLost = await this.sessionRepo
        .createQueryBuilder()
        .update(MarketReturnHandoverSessionEntity)
        .set({
          status: MarketHandoverSessionStatus.CLOSED,
          closed_at: now,
          close_reason: MarketHandoverCloseReason.HEARTBEAT_LOST,
        })
        .where('status = :active', {
          active: MarketHandoverSessionStatus.ACTIVE,
        })
        .andWhere('last_seen_at IS NOT NULL')
        .andWhere('last_seen_at <= :stale', {
          stale: now - MARKET_HANDOVER_HEARTBEAT_GRACE_MS,
        })
        .execute();

      // Skanerlanmagan (PENDING) QR'lar ham eskiradi — 2 daqiqa.
      const stalePending = await this.sessionRepo
        .createQueryBuilder()
        .update(MarketReturnHandoverSessionEntity)
        .set({
          status: MarketHandoverSessionStatus.CLOSED,
          closed_at: now,
          close_reason: MarketHandoverCloseReason.EXPIRED,
        })
        .where('status = :pending', {
          pending: MarketHandoverSessionStatus.PENDING,
        })
        .andWhere('qr_expires_at <= :now', { now })
        .execute();

      const total =
        Number(expired.affected ?? 0) +
        Number(heartbeatLost.affected ?? 0) +
        Number(stalePending.affected ?? 0);
      if (total > 0) {
        this.logger.log(
          `Topshirish sessiyalari yopildi: muddati o'tgan ${expired.affected ?? 0}, ` +
            `heartbeat uzilgan ${heartbeatLost.affected ?? 0}, eski QR ${stalePending.affected ?? 0}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `closeDeadSessions xato: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.sweepingSessions = false;
    }
  }
}
