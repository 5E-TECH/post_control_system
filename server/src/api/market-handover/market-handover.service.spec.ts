/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { MarketHandoverService } from './market-handover.service';
import { MarketReturnHandoverSessionEntity } from 'src/core/entity/market-return-handover-session.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  Order_status,
  Replacement_state,
  Roles,
  Status,
} from 'src/common/enums';
import {
  MARKET_HANDOVER_AUTH_TTL_MS,
  MARKET_HANDOVER_HEARTBEAT_GRACE_MS,
  MARKET_HANDOVER_PIN_MAX_ATTEMPTS,
  MARKET_HANDOVER_QR_TTL_MS,
  MarketHandoverCloseReason,
  MarketHandoverMode,
  MarketHandoverSessionStatus,
} from './market-handover.enums';
import { JwtPayload } from 'src/common/utils/types/user.type';

const uuid = (n: number) =>
  `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;

const MARKET_ID = uuid(1);
const STAFF_ID = uuid(2);
const OTHER_STAFF_ID = uuid(3);

const staff = (id = STAFF_ID): JwtPayload =>
  ({ id, role: Roles.REGISTRATOR, status: Status.ACTIVE }) as JwtPayload;
const marketUser = (): JwtPayload =>
  ({ id: MARKET_ID, role: Roles.MARKET, status: Status.ACTIVE }) as JwtPayload;

/** Faol (ACTIVE) sessiya — topshirish oynasi ochiq. */
const activeSession = (over: Record<string, any> = {}) => ({
  id: uuid(10),
  market_id: MARKET_ID,
  status: MarketHandoverSessionStatus.ACTIVE,
  scanned_by_user_id: STAFF_ID,
  authorization_expires_at: Date.now() + MARKET_HANDOVER_AUTH_TTL_MS,
  last_seen_at: Date.now(),
  handed_over_count: 0,
  ...over,
});

const awaitingOrder = (over: Record<string, any> = {}) => ({
  id: uuid(20),
  order_number: 100500,
  user_id: MARKET_ID,
  status: Order_status.CANCELLED_SENT,
  total_price: 50000,
  is_replacement_return: false,
  center_received_at: Date.now() - 86_400_000,
  market_handover_at: null,
  ...over,
});

describe('MarketHandoverService', () => {
  let service: MarketHandoverService;
  let sessionRepo: any;
  let orderRepo: any;
  let userRepo: any;
  let dataSource: { createQueryRunner: jest.Mock };
  let updated: { repo: string; criteria: any; partial: any }[];
  let saved: any[];
  let qr: any;

  beforeEach(async () => {
    updated = [];
    saved = [];

    const makeRepoMock = (name: string) => ({
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn((entity: any) => {
        if (!entity.id) entity.id = uuid(10);
        saved.push(entity);
        return Promise.resolve(entity);
      }),
      update: jest.fn((criteria: any, partial: any) => {
        updated.push({ repo: name, criteria, partial });
        return Promise.resolve({ affected: 1 });
      }),
      createQueryBuilder: jest.fn(),
    });

    sessionRepo = makeRepoMock('session');
    orderRepo = makeRepoMock('order');
    userRepo = makeRepoMock('user');

    // `qr.manager.getRepository(Entity)` -> mos mock
    const manager = {
      getRepository: jest.fn((Entity: any) => {
        if (Entity === MarketReturnHandoverSessionEntity) return sessionRepo;
        if (Entity === OrderEntity) return orderRepo;
        return userRepo;
      }),
    };
    qr = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      manager,
    };
    dataSource = { createQueryRunner: jest.fn(() => qr) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketHandoverService,
        {
          provide: getRepositoryToken(MarketReturnHandoverSessionEntity),
          useValue: sessionRepo,
        },
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: ActivityLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(MarketHandoverService);
  });

  // ══════════════════ MARKET: RUXSAT YARATISH ══════════════════

  describe('createConsent', () => {
    it('XOM TOKEN SAQLANMAYDI — faqat sha256 hex (64 belgi)', async () => {
      const res: any = await service.createConsent(marketUser());

      const row = saved[0];
      expect(row.qr_token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.pin_hash).toMatch(/^[0-9a-f]{64}$/);
      // Xom token javobda bor, LEKIN bazadagi qatorda yo'q.
      // ⚠️ KICHIK harfli prefiks: apparat skaner yo'li buzilmasligi uchun
      // (klient `normalizeQrToken` hammasini kichik harfga tushiradi).
      expect(res.data.qr_token).toMatch(/^mrc-[0-9a-f]{32}$/);
      expect(JSON.stringify(row)).not.toContain(res.data.qr_token);
      expect(JSON.stringify(row)).not.toContain(res.data.pin);
    });

    it('QR 2 daqiqa amal qiladi va PIN 6 xonali', async () => {
      const before = Date.now();
      const res: any = await service.createConsent(marketUser());

      expect(res.data.pin).toMatch(/^\d{6}$/);
      expect(res.data.ttl_seconds).toBe(MARKET_HANDOVER_QR_TTL_MS / 1000);
      expect(res.data.expires_at).toBeGreaterThanOrEqual(
        before + MARKET_HANDOVER_QR_TTL_MS,
      );
    });

    it('market_id TOKENDAN olinadi (URL/body dan emas — IDOR)', async () => {
      await service.createConsent(marketUser());
      expect(saved[0].market_id).toBe(MARKET_ID);
    });

    it('oldingi ishlatilmagan ruxsat BEKOR qilinadi', async () => {
      await service.createConsent(marketUser());

      const supersede = updated.find(
        (u) => u.partial?.close_reason === MarketHandoverCloseReason.SUPERSEDED,
      );
      expect(supersede?.criteria).toEqual({
        market_id: MARKET_ID,
        status: MarketHandoverSessionStatus.PENDING,
      });
    });
  });

  // ══════════════════ XODIM: SKAN / PIN ══════════════════

  // ══════════════════ MARKET: RUXSAT HOLATI ══════════════════

  /**
   * ⚠️ NEGA BU YO'L BOR. QR/PIN BIR MARTALIK: xodim skanerlashi bilan
   * sessiya `PENDING → ACTIVE` ga o'tadi va eski kod o'ladi. Market
   * ekranida esa QR sanoq bilan TURAVERARDI — market yaroqsiz kodni
   * ko'rsatib, xodim «muddati tugagan» xatosini olardi.
   */
  describe('consentStatus', () => {
    it('SIR QAYTMAYDI — token/PIN javobda yo‘q', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: uuid(10),
        status: MarketHandoverSessionStatus.PENDING,
        qr_expires_at: Date.now() + 60_000,
        qr_token_hash: 'a'.repeat(64),
        pin_hash: 'b'.repeat(64),
        handed_over_count: 0,
      });
      const res: any = await service.consentStatus(marketUser());
      const text = JSON.stringify(res);
      expect(text).not.toContain('a'.repeat(64));
      expect(text).not.toContain('b'.repeat(64));
      expect(res.data.qr_token).toBeUndefined();
      expect(res.data.pin).toBeUndefined();
    });

    it('QR tirik → waiting, qolgan soniya bilan', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: uuid(10),
        status: MarketHandoverSessionStatus.PENDING,
        qr_expires_at: Date.now() + 90_000,
        handed_over_count: 0,
      });
      const res: any = await service.consentStatus(marketUser());
      expect(res.data.state).toBe('waiting');
      expect(res.data.seconds_left).toBeGreaterThan(80);
      expect(res.data.seconds_left).toBeLessThanOrEqual(90);
    });

    it('PENDING lekin muddat o‘tgan → expired', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: uuid(10),
        status: MarketHandoverSessionStatus.PENDING,
        qr_expires_at: Date.now() - 1_000,
        handed_over_count: 0,
      });
      const res: any = await service.consentStatus(marketUser());
      expect(res.data.state).toBe('expired');
      expect(res.data.seconds_left).toBe(0);
    });

    it('xodim skanerlagan → handover, ruxsat oynasi qolgan soniyasi', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: uuid(10),
        status: MarketHandoverSessionStatus.ACTIVE,
        qr_expires_at: Date.now() - 5_000,
        authorization_expires_at: Date.now() + 300_000,
        handed_over_count: 3,
      });
      const res: any = await service.consentStatus(marketUser());
      expect(res.data.state).toBe('handover');
      expect(res.data.seconds_left).toBeGreaterThan(290);
      expect(res.data.handed_over_count).toBe(3);
    });

    it('PIN bloklangan sessiya → done + pin_blocked', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: uuid(10),
        status: MarketHandoverSessionStatus.CLOSED,
        qr_expires_at: Date.now() - 5_000,
        close_reason: MarketHandoverCloseReason.PIN_BLOCKED,
        handed_over_count: 0,
      });
      const res: any = await service.consentStatus(marketUser());
      expect(res.data.state).toBe('done');
      expect(res.data.pin_blocked).toBe(true);
    });

    it('oddiy yopilgan sessiya → done, pin_blocked FALSE', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: uuid(10),
        status: MarketHandoverSessionStatus.CLOSED,
        qr_expires_at: Date.now() - 5_000,
        close_reason: MarketHandoverCloseReason.FINISHED,
        handed_over_count: 4,
      });
      const res: any = await service.consentStatus(marketUser());
      expect(res.data.state).toBe('done');
      expect(res.data.pin_blocked).toBe(false);
    });

    it('sessiya umuman yo‘q → none', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      const res: any = await service.consentStatus(marketUser());
      expect(res.data.state).toBe('none');
    });
  });

  describe('scan', () => {
    it('PENDING ruxsatni ACTIVE qiladi va 10 daqiqalik oyna beradi', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: uuid(10),
        market_id: MARKET_ID,
        status: MarketHandoverSessionStatus.PENDING,
        qr_expires_at: Date.now() + 60_000,
      });

      const res: any = await service.scan({ qr_token: 'mrc-abc' }, staff());

      expect(res.data.authorization_token).toMatch(/^MRA-/);
      expect(res.data.remaining_seconds).toBe(
        MARKET_HANDOVER_AUTH_TTL_MS / 1000,
      );
      const patch = updated.find((u) => u.repo === 'session')?.partial;
      expect(patch.status).toBe(MarketHandoverSessionStatus.ACTIVE);
      // Ruxsat AYNAN skanerlagan xodimga tegishli.
      expect(patch.scanned_by_user_id).toBe(STAFF_ID);
      // Hash saqlanadi, xom token emas.
      expect(patch.authorization_token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(patch.last_seen_at).toBeGreaterThan(0);
    });

    it('muddati o‘tgan QR rad etiladi va sessiya YOPILADI', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: uuid(10),
        market_id: MARKET_ID,
        status: MarketHandoverSessionStatus.PENDING,
        qr_expires_at: Date.now() - 1,
      });

      await expect(
        service.scan({ qr_token: 'mrc-abc' }, staff()),
      ).rejects.toThrow(BadRequestException);

      expect(
        updated.find(
          (u) => u.partial?.close_reason === MarketHandoverCloseReason.EXPIRED,
        ),
      ).toBeTruthy();
    });

    it('allaqachon ishlatilgan ruxsat qayta skanerlanmaydi', async () => {
      sessionRepo.findOne.mockResolvedValue(activeSession());
      await expect(
        service.scan({ qr_token: 'mrc-abc' }, staff()),
      ).rejects.toThrow(BadRequestException);
    });

    it('QR prefiksi noto‘g‘ri bo‘lsa rad etiladi', async () => {
      await expect(
        service.scan({ qr_token: 'XXX-abc' }, staff()),
      ).rejects.toThrow(BadRequestException);
    });

    it('⭐ APPARAT SKANER: KATTA harfda kelgan QR ham qabul qilinadi', async () => {
      // Caps Lock yoqiq skaner `MRC-ABC` yuborishi mumkin; klient
      // normalizatori `mrc-abc` qiladi. Ikkisi ham AYNI sessiyani topishi
      // shart — aks holda skaner yo'li jimgina o'lik bo'ladi.
      sessionRepo.findOne.mockResolvedValue({
        id: uuid(10),
        market_id: MARKET_ID,
        status: MarketHandoverSessionStatus.PENDING,
        qr_expires_at: Date.now() + 60_000,
      });

      const res: any = await service.scan({ qr_token: '  MRC-AbC12  ' }, staff());
      expect(res.data.authorization_token).toMatch(/^MRA-/);
      // Qidiruv KICHIK harfli tokenning hashi bilan ketgan.
      const lookedUp = sessionRepo.findOne.mock.calls[0][0].where.qr_token_hash;
      expect(lookedUp).toBe(
        require('crypto').createHash('sha256').update('mrc-abc12').digest('hex'),
      );
    });

    it('PIN yo‘lida market_id MAJBURIY (brute-force maydonini qisadi)', async () => {
      await expect(service.scan({ pin: '123456' }, staff())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('noto‘g‘ri PIN urinishini SANAYDI', async () => {
      // 1-chaqiruv: pin_hash bo'yicha topilmaydi; 2-chaqiruv: oxirgi PENDING.
      sessionRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: uuid(10), pin_attempts: 1 });

      await expect(
        service.scan({ market_id: MARKET_ID, pin: '000000' }, staff()),
      ).rejects.toThrow(ForbiddenException);

      expect(updated.find((u) => u.repo === 'session')?.partial).toEqual({
        pin_attempts: 2,
      });
    });

    it('PIN chegarasidan oshsa sessiya BLOKLANADI', async () => {
      sessionRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: uuid(10),
        pin_attempts: MARKET_HANDOVER_PIN_MAX_ATTEMPTS - 1,
      });

      await expect(
        service.scan({ market_id: MARKET_ID, pin: '000000' }, staff()),
      ).rejects.toThrow(ForbiddenException);

      expect(updated.find((u) => u.repo === 'session')?.partial).toEqual(
        expect.objectContaining({
          status: MarketHandoverSessionStatus.CLOSED,
          close_reason: MarketHandoverCloseReason.PIN_BLOCKED,
        }),
      );
    });
  });

  // ══════════════════ RUXSAT GUARDLARI ══════════════════

  describe('ruxsat guardlari', () => {
    const dto = (over: Record<string, any> = {}) => ({
      market_id: MARKET_ID,
      order_ids: [uuid(20)],
      authorization_token: 'MRA-token',
      ...over,
    });

    it('BOSHQA xodim ayni ruxsat bilan topshira olmaydi (403)', async () => {
      sessionRepo.findOne.mockResolvedValue(activeSession());
      await expect(
        service.complete(dto(), staff(OTHER_STAFF_ID)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('10 daqiqalik oyna tugasa rad etiladi va sessiya yopiladi', async () => {
      sessionRepo.findOne.mockResolvedValue(
        activeSession({ authorization_expires_at: Date.now() - 1 }),
      );

      await expect(service.complete(dto(), staff())).rejects.toThrow(
        ForbiddenException,
      );
      expect(
        updated.find(
          (u) => u.partial?.close_reason === MarketHandoverCloseReason.EXPIRED,
        ),
      ).toBeTruthy();
    });

    it('SAHIFAGA BOG‘LANISH: heartbeat uzilsa ruxsat o‘ladi', async () => {
      sessionRepo.findOne.mockResolvedValue(
        activeSession({
          last_seen_at: Date.now() - MARKET_HANDOVER_HEARTBEAT_GRACE_MS - 5_000,
        }),
      );

      await expect(service.complete(dto(), staff())).rejects.toThrow(
        ForbiddenException,
      );
      expect(
        updated.find(
          (u) =>
            u.partial?.close_reason ===
            MarketHandoverCloseReason.HEARTBEAT_LOST,
        ),
      ).toBeTruthy();
    });

    it('YOPILGAN ruxsat bilan topshirib bo‘lmaydi', async () => {
      sessionRepo.findOne.mockResolvedValue(
        activeSession({ status: MarketHandoverSessionStatus.CLOSED }),
      );
      await expect(service.complete(dto(), staff())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('ruxsat BOSHQA market uchun berilgan bo‘lsa rad etiladi', async () => {
      sessionRepo.findOne.mockResolvedValue(
        activeSession({ market_id: uuid(9) }),
      );
      await expect(service.complete(dto(), staff())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ══════════════════ TOPSHIRISH ══════════════════

  describe('complete', () => {
    const dto = (ids: string[], over: Record<string, any> = {}) => ({
      market_id: MARKET_ID,
      order_ids: ids,
      authorization_token: 'MRA-token',
      ...over,
    });

    beforeEach(() => {
      sessionRepo.findOne.mockResolvedValue(activeSession());
    });

    it('oddiy posilka CLOSED bo‘ladi va dalil yoziladi', async () => {
      const order = awaitingOrder();
      orderRepo.find.mockResolvedValue([order]);

      const res: any = await service.complete(dto([order.id]), staff());

      const patch = updated.find((u) => u.repo === 'order')?.partial;
      expect(patch.status).toBe(Order_status.CLOSED);
      expect(patch.market_handover_by).toBe(STAFF_ID);
      expect(patch.market_handover_mode).toBe(MarketHandoverMode.MARKET_WEB);
      expect(patch.market_handover_session_id).toBe(uuid(10));
      // Poyga himoyasi: dalil faqat bir marta yoziladi.
      expect(updated.find((u) => u.repo === 'order')?.criteria).toEqual(
        expect.objectContaining({ market_handover_at: expect.anything() }),
      );
      expect(res.data.handed_over).toBe(1);
    });

    it('ALMASHTIRISH qatorida status SOTILGAN qoladi, OLD_RETURNED yoziladi', async () => {
      const repl = awaitingOrder({
        id: uuid(21),
        status: Order_status.SOLD,
        is_replacement_return: true,
      });
      orderRepo.find.mockResolvedValue([repl]);

      await service.complete(dto([repl.id]), staff());

      const patch = updated.find(
        (u) => u.repo === 'order' && u.partial?.replacement_state,
      )?.partial;
      // ⚠️ Status TEGILMAYDI — puli muzlatilgan, moliyaviy reversal yo'q.
      expect(patch.status).toBeUndefined();
      expect(patch.replacement_state).toBe(Replacement_state.OLD_RETURNED);
      expect(patch.old_product_returned_at).toBeGreaterThan(0);
      expect(patch.old_returned_by).toBe(STAFF_ID);
      // Bog'liq YANGI buyurtma ham izchillik uchun yangilanadi.
      expect(
        updated.find((u) => u.criteria?.replacement_of_order_id === repl.id)
          ?.partial,
      ).toEqual({ replacement_state: Replacement_state.OLD_RETURNED });
    });

    it('QISMAN BAJARILMAYDI: bitta qator mos kelmasa BUTUN partiya rad etiladi', async () => {
      // Ikkita so'raldi, bittasi shartga mos keldi.
      orderRepo.find.mockResolvedValue([awaitingOrder()]);

      await expect(
        service.complete(dto([uuid(20), uuid(21)]), staff()),
      ).rejects.toThrow(BadRequestException);

      expect(updated.find((u) => u.repo === 'order')).toBeUndefined();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('OYNA ICHIDA KO‘P PARTIYA: sessiya birinchi partiyadan keyin yopilmaydi', async () => {
      const first = awaitingOrder({ id: uuid(20) });
      const second = awaitingOrder({ id: uuid(21) });

      orderRepo.find.mockResolvedValueOnce([first]);
      await service.complete(dto([first.id]), staff());

      orderRepo.find.mockResolvedValueOnce([second]);
      const res: any = await service.complete(dto([second.id]), staff());

      // Ikkinchi partiya ham o'tdi — `consumed`/`closed` qilinmagan.
      expect(res.data.handed_over).toBe(1);
      const sessionPatches = updated.filter((u) => u.repo === 'session');
      expect(
        sessionPatches.every(
          (p) => p.partial?.status !== MarketHandoverSessionStatus.CLOSED,
        ),
      ).toBe(true);
      // Sanoq o'sib boradi.
      expect(
        sessionPatches.filter((p) => p.partial?.handed_over_count === 1).length,
      ).toBe(2);
    });

    it('takrorlangan manual_override rad etiladi', async () => {
      await expect(
        service.complete(
          dto([uuid(20)], {
            manual_overrides: [
              { order_id: uuid(20), reason: 'QR yirtilgan' },
              { order_id: uuid(20), reason: 'QR yirtilgan' },
            ],
          }),
          staff(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('tanlanmagan buyurtmaga manual_override berib bo‘lmaydi', async () => {
      await expect(
        service.complete(
          dto([uuid(20)], {
            manual_overrides: [{ order_id: uuid(77), reason: 'QR yirtilgan' }],
          }),
          staff(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('bo‘sh order_ids rad etiladi', async () => {
      await expect(service.complete(dto([]), staff())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════ HEARTBEAT / YOPISH ══════════════════

  describe('heartbeat va release', () => {
    it('heartbeat last_seen_at ni yangilaydi', async () => {
      sessionRepo.findOne.mockResolvedValue(activeSession());
      const res: any = await service.heartbeat('MRA-token', staff());

      expect(
        updated.find((u) => u.repo === 'session')?.partial.last_seen_at,
      ).toBeGreaterThan(0);
      expect(res.data.remaining_seconds).toBeGreaterThan(0);
    });

    it('«Yakunlash» sessiyani FINISHED bilan yopadi', async () => {
      sessionRepo.findOne.mockResolvedValue(activeSession());
      await service.release('MRA-token', staff(), true);

      expect(updated.find((u) => u.repo === 'session')?.partial).toEqual(
        expect.objectContaining({
          status: MarketHandoverSessionStatus.CLOSED,
          close_reason: MarketHandoverCloseReason.FINISHED,
        }),
      );
    });

    it('sahifadan chiqish LEFT_PAGE bilan yopadi', async () => {
      sessionRepo.findOne.mockResolvedValue(activeSession());
      await service.release('MRA-token', staff(), false);

      expect(
        updated.find((u) => u.repo === 'session')?.partial.close_reason,
      ).toBe(MarketHandoverCloseReason.LEFT_PAGE);
    });

    it('IDEMPOTENT: allaqachon yopilgan/topilmagan ruxsatda ham 200', async () => {
      sessionRepo.findOne.mockResolvedValueOnce(null);
      const res1: any = await service.release('MRA-x', staff());
      expect(res1.statusCode).toBe(200);

      sessionRepo.findOne.mockResolvedValueOnce(
        activeSession({ status: MarketHandoverSessionStatus.CLOSED }),
      );
      const res2: any = await service.release('MRA-x', staff());
      expect(res2.statusCode).toBe(200);
    });

    it('boshqa xodim ruxsatni yopa olmaydi', async () => {
      sessionRepo.findOne.mockResolvedValue(activeSession());
      await expect(
        service.release('MRA-token', staff(OTHER_STAFF_ID)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════ OFFLINE AKT ══════════════════

  describe('offlineHandover', () => {
    const offlineDto = (over: Record<string, any> = {}) => ({
      market_id: MARKET_ID,
      order_ids: [uuid(20)],
      representative_name: 'Vakil Ismi',
      representative_phone: '+998901234567',
      reason: 'Market panelga kira olmadi',
      ...over,
    });

    it('OFFLINE_SIGNED rejimi bilan yopadi va vakil dalilini saqlaydi', async () => {
      userRepo.findOne.mockResolvedValue({
        id: MARKET_ID,
        name: 'Test Market',
        cancel_handover_consent_required: false,
      });
      const order = awaitingOrder();
      orderRepo.find.mockResolvedValue([order]);

      const res: any = await service.offlineHandover(offlineDto(), staff());

      expect(res.data.mode).toBe(MarketHandoverMode.OFFLINE_SIGNED);
      const orderPatch = updated.find((u) => u.repo === 'order')?.partial;
      expect(orderPatch.status).toBe(Order_status.CLOSED);
      expect(orderPatch.market_handover_mode).toBe(
        MarketHandoverMode.OFFLINE_SIGNED,
      );
      // Sessiya dalili: kim olib ketdi, telefoni, nega QR'siz.
      expect(saved[0]).toEqual(
        expect.objectContaining({
          representative_name: 'Vakil Ismi',
          representative_phone: '+998901234567',
          override_reason: 'Market panelga kira olmadi',
          close_reason: MarketHandoverCloseReason.OFFLINE_ACT,
        }),
      );
    });

    it('ruxsat MAJBURIY marketda registrator offline akt yoza olmaydi', async () => {
      userRepo.findOne.mockResolvedValue({
        id: MARKET_ID,
        name: 'Test Market',
        cancel_handover_consent_required: true,
      });

      await expect(
        service.offlineHandover(offlineDto(), staff()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ruxsat majburiy marketda ADMIN offline akt yozishi mumkin', async () => {
      userRepo.findOne.mockResolvedValue({
        id: MARKET_ID,
        name: 'Test Market',
        cancel_handover_consent_required: true,
      });
      orderRepo.find.mockResolvedValue([awaitingOrder()]);

      const admin = {
        id: STAFF_ID,
        role: Roles.ADMIN,
        status: Status.ACTIVE,
      } as JwtPayload;
      const res: any = await service.offlineHandover(offlineDto(), admin);
      expect(res.data.handed_over).toBe(1);
    });

    it('mos kelmagan qator bo‘lsa offline partiya ham rad etiladi', async () => {
      userRepo.findOne.mockResolvedValue({
        id: MARKET_ID,
        name: 'Test Market',
        cancel_handover_consent_required: false,
      });
      orderRepo.find.mockResolvedValue([]);

      await expect(
        service.offlineHandover(offlineDto(), staff()),
      ).rejects.toThrow(BadRequestException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ══════════════════ RUXSAT BAYROG'I ══════════════════

  describe('setConsentRequired', () => {
    it('bayroqni yoqadi va auditga yozadi', async () => {
      userRepo.findOne.mockResolvedValue({
        id: MARKET_ID,
        name: 'Test Market',
        cancel_handover_consent_required: false,
      });

      const res: any = await service.setConsentRequired(
        MARKET_ID,
        true,
        staff(),
      );

      expect(res.data.cancel_handover_consent_required).toBe(true);
      expect(updated.find((u) => u.repo === 'user')?.partial).toEqual({
        cancel_handover_consent_required: true,
      });
    });
  });
});
