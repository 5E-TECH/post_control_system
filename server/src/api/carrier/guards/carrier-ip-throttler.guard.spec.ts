/// <reference types="jest" />
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import config from 'src/config';
import {
  CARRIER_IP_THROTTLE_DEFAULT_LIMIT,
  CarrierIpThrottlerGuard,
  carrierIpThrottleLimit,
} from './carrier-ip-throttler.guard';
import { CarrierThrottlerGuard } from './carrier-throttler.guard';

/**
 * Autentifikatsiyadan OLDINGI limit (bitta IP, barcha carrier endpointlari).
 * Haqiqiy guard (throttler 6.5.0), haqiqiy xotira saqlagichi va PCS'ning
 * global sukuti (`ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])`).
 */

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

const req = (over: Record<string, unknown> = {}) => ({
  headers: {},
  ip: '198.51.100.7',
  originalUrl: '/api/v1/carrier/ping',
  ...over,
});

const storages: ThrottlerStorageService[] = [];

async function realGuard<
  T extends CarrierIpThrottlerGuard | CarrierThrottlerGuard,
>(Guard: new (...args: any[]) => T, storage = new ThrottlerStorageService()) {
  storages.push(storage);
  const guard = new Guard(
    [{ ttl: 60_000, limit: 60 }],
    storage,
    new Reflector(),
  );
  await guard.onModuleInit();
  return guard;
}

describe('CarrierIpThrottlerGuard', () => {
  const saved = {
    ip: config.CARRIER_IP_THROTTLE_LIMIT,
    limit: config.CARRIER_THROTTLE_LIMIT,
    ttl: config.CARRIER_THROTTLE_TTL_MS,
  };
  afterEach(() => {
    config.CARRIER_IP_THROTTLE_LIMIT = saved.ip;
    config.CARRIER_THROTTLE_LIMIT = saved.limit;
    config.CARRIER_THROTTLE_TTL_MS = saved.ttl;
    // Saqlagichning ttl taymerlari jest jarayonini ushlab turmasin.
    storages.splice(0).forEach((s) => s.onApplicationShutdown());
  });

  const internals = Object.create(
    CarrierIpThrottlerGuard.prototype,
  ) as unknown as GuardInternals;

  it('tracker — req.ip (::ffff: siz), aniqlanmasa umumiy savat', async () => {
    await expect(internals.getTracker({ ip: '::ffff:1.2.3.4' })).resolves.toBe(
      'ip-1.2.3.4',
    );
    await expect(internals.getTracker({})).resolves.toBe('ip-unknown');
  });

  it('kalit endpointga bog‘liq emas va akkaunt savatidan ALOHIDA', () => {
    const a = internals.generateKey(
      ctxFor('scan', {}),
      'ip-1.2.3.4',
      'default',
    );
    const b = internals.generateKey(
      ctxFor('updateStatus', {}),
      'ip-1.2.3.4',
      'default',
    );
    expect(a).toBe(b);
    const accountKey = (
      Object.create(CarrierThrottlerGuard.prototype) as GuardInternals
    ).generateKey(ctxFor('scan', {}), 'ip-1.2.3.4', 'default');
    expect(a).not.toBe(accountKey);
  });

  it('limit config’dan HAR SO‘ROVDA; noto‘g‘ri qiymat — sukut 600', () => {
    config.CARRIER_IP_THROTTLE_LIMIT = 900;
    expect(carrierIpThrottleLimit()).toBe(900);
    for (const bad of [0, -5, 1.5, Number.NaN]) {
      config.CARRIER_IP_THROTTLE_LIMIT = bad;
      expect(carrierIpThrottleLimit()).toBe(CARRIER_IP_THROTTLE_DEFAULT_LIMIT);
    }
  });

  it('⭐ kalitsiz oqim ham cheklanadi: limitdan keyin 429 + Retry-After, boshqa IP ta’sirlanmaydi', async () => {
    config.CARRIER_IP_THROTTLE_LIMIT = 3;
    config.CARRIER_THROTTLE_TTL_MS = 60_000;
    const guard = await realGuard(CarrierIpThrottlerGuard);
    // `request.carrier` YO'Q — kalit guardi hali ishlamagan.
    for (const handler of ['ping', 'scan', 'orders']) {
      await expect(guard.canActivate(ctxFor(handler, req()))).resolves.toBe(
        true,
      );
    }
    const res = { header: jest.fn() };
    await expect(
      guard.canActivate(ctxFor('cashbox', req(), res)),
    ).rejects.toBeInstanceOf(ThrottlerException);
    expect(res.header).toHaveBeenCalledWith('Retry-After', expect.any(Number));

    await expect(
      guard.canActivate(ctxFor('ping', req({ ip: '198.51.100.8' }))),
    ).resolves.toBe(true);
  });

  it('IP savati akkaunt savatiga aralashmaydi (bitta saqlagich)', async () => {
    config.CARRIER_IP_THROTTLE_LIMIT = 2;
    config.CARRIER_THROTTLE_LIMIT = 2;
    const storage = new ThrottlerStorageService();
    const ipGuard = await realGuard(CarrierIpThrottlerGuard, storage);
    const accountGuard = await realGuard(CarrierThrottlerGuard, storage);
    const r = req({ carrier: { id: 'acc-1' } });
    await expect(ipGuard.canActivate(ctxFor('ping', r))).resolves.toBe(true);
    await expect(accountGuard.canActivate(ctxFor('ping', r))).resolves.toBe(
      true,
    );
    await expect(ipGuard.canActivate(ctxFor('ping', r))).resolves.toBe(true);
    await expect(accountGuard.canActivate(ctxFor('ping', r))).resolves.toBe(
      true,
    );
  });

  it('⭐ kanonik bo‘lmagan yo‘l — limit savati ochilmasdan 404 (soxta IP bilan aylanib o‘tib bo‘lmaydi)', async () => {
    config.CARRIER_IP_THROTTLE_LIMIT = 1;
    const guard = await realGuard(CarrierIpThrottlerGuard);
    for (const ip of ['10.0.0.1', '10.0.0.2']) {
      const error = await guard
        .canActivate(
          ctxFor('ping', req({ ip, originalUrl: '/api/v1/CARRIER/ping' })),
        )
        .then(
          () => null,
          (e: unknown) => e,
        );
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
    }
    // Kanonik yo'ldagi birinchi so'rov hali limitga tegmagan.
    await expect(
      guard.canActivate(ctxFor('ping', req({ ip: '10.0.0.1' }))),
    ).resolves.toBe(true);
  });
});
