/// <reference types="jest" />
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import config from 'src/config';
import {
  CARRIER_THROTTLE,
  CARRIER_THROTTLE_DEFAULT_LIMIT,
  CARRIER_THROTTLE_DEFAULT_TTL_MS,
  CarrierThrottlerGuard,
  carrierThrottleLimit,
  carrierThrottleTtlMs,
} from './carrier-throttler.guard';

type GuardInternals = {
  getTracker(req: Record<string, unknown>): Promise<string>;
  generateKey(ctx: ExecutionContext, suffix: string, name: string): string;
};

const ctxFor = (
  handlerName: string,
  req: Record<string, unknown>,
  res: Record<string, unknown> = { header: jest.fn() },
) =>
  ({
    getClass: () => ({ name: 'CarrierPublicController' }),
    getHandler: () => ({ name: handlerName }),
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  }) as unknown as ExecutionContext;

/**
 * Haqiqiy guard (throttler 6.5.0), haqiqiy xotira saqlagichi va PCS'ning
 * global sukuti (`ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])`).
 */
const storages: ThrottlerStorageService[] = [];

async function realGuard(storage = new ThrottlerStorageService()) {
  storages.push(storage);
  const guard = new CarrierThrottlerGuard(
    [{ ttl: 60_000, limit: 60 }],
    storage,
    new Reflector(),
  );
  await guard.onModuleInit();
  return { guard, storage };
}

describe('CarrierThrottlerGuard', () => {
  const saved = {
    limit: config.CARRIER_THROTTLE_LIMIT,
    ttl: config.CARRIER_THROTTLE_TTL_MS,
  };
  afterEach(() => {
    config.CARRIER_THROTTLE_LIMIT = saved.limit;
    config.CARRIER_THROTTLE_TTL_MS = saved.ttl;
    // Saqlagichning ttl taymerlari jest jarayonini ushlab turmasin.
    storages.splice(0).forEach((s) => s.onApplicationShutdown());
  });

  const internals = Object.create(
    CarrierThrottlerGuard.prototype,
  ) as unknown as GuardInternals;

  it('tracker — carrier akkaunt id (IP emas); carrier yo‘q bo‘lsa req.ip', async () => {
    await expect(
      internals.getTracker({ carrier: { id: 'acc-3' }, ip: '1.2.3.4' }),
    ).resolves.toBe('carrier-acc-3');
    await expect(internals.getTracker({ ip: '1.2.3.4' })).resolves.toBe(
      'ip-1.2.3.4',
    );
    await expect(internals.getTracker({})).resolves.toBe('unknown');
  });

  it('⭐ kalit endpointga bog‘liq EMAS — bitta carrier, bitta savat', () => {
    const scan = internals.generateKey(
      ctxFor('scan', {}),
      'carrier-acc-3',
      'default',
    );
    const status = internals.generateKey(
      ctxFor('updateStatus', {}),
      'carrier-acc-3',
      'default',
    );
    const other = internals.generateKey(
      ctxFor('scan', {}),
      'carrier-acc-4',
      'default',
    );
    expect(scan).toBe(status);
    expect(scan).not.toBe(other);
  });

  it('limit va ttl config’dan HAR SO‘ROVDA o‘qiladi; noto‘g‘ri qiymat — sukut', () => {
    config.CARRIER_THROTTLE_LIMIT = 300;
    config.CARRIER_THROTTLE_TTL_MS = 30_000;
    expect(carrierThrottleLimit()).toBe(300);
    expect(carrierThrottleTtlMs()).toBe(30_000);
    for (const bad of [0, -5, 1.5, Number.NaN]) {
      config.CARRIER_THROTTLE_LIMIT = bad;
      expect(carrierThrottleLimit()).toBe(CARRIER_THROTTLE_DEFAULT_LIMIT);
    }
    config.CARRIER_THROTTLE_TTL_MS = 0;
    expect(carrierThrottleTtlMs()).toBe(CARRIER_THROTTLE_DEFAULT_TTL_MS);
  });

  it('@Throttle uchun resolvable qiymatlar (Elchi bilan bir xil shakl)', () => {
    expect(CARRIER_THROTTLE.default.limit).toBe(carrierThrottleLimit);
    expect(CARRIER_THROTTLE.default.ttl).toBe(carrierThrottleTtlMs);
  });

  it('⭐ BUTUN akkaunt uchun limit: turli endpointlar bitta savatdan yeydi, keyin 429 + Retry-After', async () => {
    config.CARRIER_THROTTLE_LIMIT = 3;
    config.CARRIER_THROTTLE_TTL_MS = 60_000;
    const { guard } = await realGuard();
    const req = { carrier: { id: 'acc-1' }, headers: {}, ip: '1.2.3.4' };

    await expect(guard.canActivate(ctxFor('scan', req))).resolves.toBe(true);
    await expect(guard.canActivate(ctxFor('updateStatus', req))).resolves.toBe(
      true,
    );
    await expect(guard.canActivate(ctxFor('orders', req))).resolves.toBe(true);

    const res = { header: jest.fn() };
    await expect(
      guard.canActivate(ctxFor('cashbox', req, res)),
    ).rejects.toBeInstanceOf(ThrottlerException);
    expect(res.header).toHaveBeenCalledWith('Retry-After', expect.any(Number));

    // Boshqa kompaniyaga ta'sir qilmaydi.
    await expect(
      guard.canActivate(
        ctxFor('scan', {
          carrier: { id: 'acc-2' },
          headers: {},
          ip: '1.2.3.4',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('⭐ global sukut (60/min) EMAS, carrier limiti qo‘llanadi — dekoratorsiz ham', async () => {
    config.CARRIER_THROTTLE_LIMIT = 120;
    const { guard } = await realGuard();
    const req = { carrier: { id: 'acc-9' }, headers: {}, ip: '1.2.3.4' };
    for (let i = 0; i < 120; i++) {
      await expect(guard.canActivate(ctxFor('scan', req))).resolves.toBe(true);
    }
    await expect(guard.canActivate(ctxFor('scan', req))).rejects.toBeInstanceOf(
      ThrottlerException,
    );
  });
});
