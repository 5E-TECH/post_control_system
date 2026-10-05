/// <reference types="jest" />

// `findMarketGroup` jonli `EntityManager` so'raydi — cron testida DB yo'q.
// Mocklanmasa chaqiruv yiqilib, try/catch uni jim yutadi va "xabar
// yuborilmadi" degan YOLG'ON yashil test chiqadi.
jest.mock('src/common/utils/telegram-group.util', () => ({
  findMarketGroup: jest.fn().mockResolvedValue({ group_id: 'g-1' }),
}));

import { MarketHandoverCron } from './market-handover.cron';
import {
  MarketHandoverCloseReason,
  MarketHandoverSessionStatus,
} from './market-handover.enums';

/**
 * ⚠️ ENG MUHIM INVARIANT: CRON HECH QACHON STATUSNI O'ZGARTIRMAYDI.
 *
 * «Marketga topshirildi» — JISMONIY fakt. Agar cron 14 kundan keyin
 * posilkani o'zi yopsa, tizim yolg'on gapiradi: mol omborda turadi, market
 * esa hech narsa olmagan. Avto-yopish YO'Q — bu qulflangan mahsulot qarori
 * (foydalanuvchi qarori, 2026-10-05) va shu test uni qo'riqlaydi.
 */

const DAY = 86_400_000;

function buildCron(rows: Record<string, unknown>[] = []) {
  const updates: { criteria: unknown; partial: Record<string, unknown> }[] = [];
  const sessionUpdates: Record<string, unknown>[] = [];
  const messages: string[] = [];

  const qb: Record<string, unknown> = {};
  const chain = () => qb;
  Object.assign(qb, {
    where: jest.fn(chain),
    andWhere: jest.fn(chain),
    select: jest.fn(chain),
    addSelect: jest.fn(chain),
    groupBy: jest.fn(chain),
    setParameters: jest.fn(chain),
    limit: jest.fn(chain),
    getMany: jest.fn().mockResolvedValue(rows),
    getRawOne: jest.fn().mockResolvedValue({ c: 0, m: 0 }),
  });

  const sessionQb: Record<string, unknown> = {};
  Object.assign(sessionQb, {
    update: jest.fn(() => sessionQb),
    set: jest.fn((partial: Record<string, unknown>) => {
      sessionUpdates.push(partial);
      return sessionQb;
    }),
    where: jest.fn(() => sessionQb),
    andWhere: jest.fn(() => sessionQb),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  });

  const cron: any = Object.create(MarketHandoverCron.prototype);
  cron.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  cron.orderRepo = {
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn((criteria: unknown, partial: Record<string, unknown>) => {
      updates.push({ criteria, partial });
      return Promise.resolve({ affected: 1 });
    }),
  };
  cron.sessionRepo = { createQueryBuilder: jest.fn(() => sessionQb) };
  cron.dataSource = { manager: {} };
  cron.botService = {
    sendMessageToGroup: jest.fn((_g: unknown, msg: string) => {
      messages.push(msg);
      return Promise.resolve();
    }),
  };
  cron.activityLog = { log: jest.fn() };
  cron.reminding = false;
  cron.escalating = false;
  cron.sweepingSessions = false;

  return { cron, updates, sessionUpdates, messages, qb };
}

describe('MarketHandoverCron — eslatma', () => {
  it("market bo'yicha BITTA xabar yuboradi (posilka-posilka emas)", async () => {
    const { cron, messages } = buildCron([
      { id: 'o1', user_id: 'm1', center_received_at: Date.now() - 4 * DAY },
      { id: 'o2', user_id: 'm1', center_received_at: Date.now() - 5 * DAY },
      { id: 'o3', user_id: 'm2', center_received_at: Date.now() - 4 * DAY },
    ]);

    await cron.remindMarkets();

    // 3 posilka, 2 market → 2 xabar.
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('2 ta bekor qilingan buyurtma');
  });

  it("IDEMPOTENT: belgi qo'yiladi va shart `IS NULL` bilan to'siladi", async () => {
    const { cron, updates } = buildCron([
      { id: 'o1', user_id: 'm1', center_received_at: Date.now() - 4 * DAY },
    ]);

    await cron.remindMarkets();

    expect(updates).toHaveLength(1);
    expect(updates[0].partial.handover_notified_at).toBeGreaterThan(0);
    // Takroriy tikda ayni qatorga qayta yozilmasligi uchun.
    expect(updates[0].criteria).toEqual(
      expect.objectContaining({ handover_notified_at: expect.anything() }),
    );
    // ⚠️ STATUS TEGILMAYDI.
    expect(updates[0].partial.status).toBeUndefined();
  });

  it("Telegram yiqilsa ham BELGI qo'yiladi (aks holda eslatma abadiy qaytarardi)", async () => {
    const { cron, updates } = buildCron([
      { id: 'o1', user_id: 'm1', center_received_at: Date.now() - 4 * DAY },
    ]);
    cron.botService.sendMessageToGroup = jest
      .fn()
      .mockRejectedValue(new Error('telegram down'));

    await cron.remindMarkets();

    expect(updates).toHaveLength(1);
    expect(updates[0].partial.handover_notified_at).toBeGreaterThan(0);
  });

  it("qator yo'q bo'lsa hech narsa yozmaydi", async () => {
    const { cron, updates, messages } = buildCron([]);
    await cron.remindMarkets();
    expect(updates).toHaveLength(0);
    expect(messages).toHaveLength(0);
  });

  it("parallel tik ikkinchi marta ishlamaydi (`reminding` bayrog'i)", async () => {
    const { cron, messages } = buildCron([
      { id: 'o1', user_id: 'm1', center_received_at: Date.now() - 4 * DAY },
    ]);
    cron.reminding = true;
    await cron.remindMarkets();
    expect(messages).toHaveLength(0);
  });
});

describe('MarketHandoverCron — eskalatsiya', () => {
  it("faqat BELGI qo'yadi, STATUSNI O'ZGARTIRMAYDI", async () => {
    const { cron, updates } = buildCron([
      { id: 'o1', order_number: 101, user_id: 'm1' },
    ]);

    await cron.escalateStale();

    expect(updates).toHaveLength(1);
    expect(updates[0].partial.handover_escalated_at).toBeGreaterThan(0);
    // ⭐ AVTO-YOPISH YO'Q — bu qulflangan qaror.
    expect(updates[0].partial.status).toBeUndefined();
    expect(updates[0].partial.market_handover_at).toBeUndefined();
    expect(updates[0].partial.market_handover_mode).toBeUndefined();
  });

  it('eskalatsiya auditga yoziladi', async () => {
    const { cron } = buildCron([
      { id: 'o1', order_number: 101, user_id: 'm1' },
    ]);
    await cron.escalateStale();
    expect(cron.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'handover_escalated' }),
    );
  });

  it('14 kunlik ogohlantirish statusga TEGMAYDI', async () => {
    const { cron, updates, qb } = buildCron([]);
    (qb.getRawOne as jest.Mock).mockResolvedValue({ c: 42, m: 5 });

    await cron.escalateStale();

    // Faqat ovozli log — hech qanday yozuv yo'q.
    expect(updates).toHaveLength(0);
    expect(cron.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('OMBOR MUDDATI'),
    );
  });
});

describe("MarketHandoverCron — o'lik sessiyalarni yopish", () => {
  it("muddati o'tgan, heartbeat uzilgan va eski QR sessiyalarini yopadi", async () => {
    const { cron, sessionUpdates } = buildCron([]);

    await cron.closeDeadSessions();

    expect(sessionUpdates).toHaveLength(3);
    for (const patch of sessionUpdates) {
      expect(patch.status).toBe(MarketHandoverSessionStatus.CLOSED);
      expect(patch.closed_at).toBeGreaterThan(0);
    }
    const reasons = sessionUpdates.map((p) => p.close_reason);
    expect(reasons).toContain(MarketHandoverCloseReason.EXPIRED);
    expect(reasons).toContain(MarketHandoverCloseReason.HEARTBEAT_LOST);
  });

  it('sessiya yopilishi BUYURTMAGA tegmaydi', async () => {
    const { cron, updates } = buildCron([]);
    await cron.closeDeadSessions();
    expect(updates).toHaveLength(0);
  });
});
