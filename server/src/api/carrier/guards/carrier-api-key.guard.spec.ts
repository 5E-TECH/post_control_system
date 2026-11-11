/// <reference types="jest" />
import { HttpException, Logger } from '@nestjs/common';
import {
  CARRIER_INVALID_KEY_MESSAGE,
  CarrierApiKeyGuard,
  isCanonicalCarrierPath,
} from './carrier-api-key.guard';
import { CARRIER_ERROR_CODES } from '../carrier-error-codes';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const COURIER_ID = '22222222-2222-4222-8222-222222222222';

const account = (over: Record<string, unknown> = {}) => ({
  id: ACCOUNT_ID,
  name: 'BTS Express',
  courier_user_id: COURIER_ID,
  is_active: true,
  ip_allowlist: null as string[] | null,
  ...over,
});

const ctx = (req: any) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

const request = (over: Record<string, unknown> = {}): any => ({
  headers: { 'x-api-key': 'bpc_secret' },
  ip: '203.0.113.10',
  originalUrl: '/api/v1/carrier/ping',
  ...over,
});

function setup(validation: unknown) {
  const accounts = {
    validateKey:
      validation instanceof Error
        ? jest.fn().mockRejectedValue(validation)
        : jest.fn().mockResolvedValue(validation),
    touchLastUsed: jest.fn(),
  };
  const guard = new CarrierApiKeyGuard(accounts as any);
  return { guard, accounts };
}

/** Guard xatosini kontrakt shaklida ochib beradi: status + javob tanasi. */
async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    const ex = e as HttpException;
    return { status: ex.getStatus(), body: ex.getResponse() as any };
  }
  throw new Error('Guard xato tashlashi kerak edi');
}

describe('CarrierApiKeyGuard', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  it("to'g'ri kalit — o'tadi, request.carrier to'ldiriladi, last_used yangilanadi", async () => {
    const { guard, accounts } = setup({
      account: account(),
      courierActive: true,
    });
    const req = request({ headers: { 'x-api-key': '  bpc_secret  ' } });

    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);

    expect(accounts.validateKey).toHaveBeenCalledWith('bpc_secret');
    expect(req.carrier).toEqual({
      id: ACCOUNT_ID,
      name: 'BTS Express',
      courier_user_id: COURIER_ID,
    });
    expect(accounts.touchLastUsed).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it('kalit yo‘q — 401, bazaga bormaydi', async () => {
    const { guard, accounts } = setup(null);
    const res = await failure(guard.canActivate(ctx(request({ headers: {} }))));
    expect(res.status).toBe(401);
    expect(accounts.validateKey).not.toHaveBeenCalled();
  });

  it("⭐ kalit yo'q va kalit noma'lum — AYNI 401 matni (kontrakt)", async () => {
    const missing = await failure(
      setup(null).guard.canActivate(
        ctx(request({ headers: { 'x-api-key': ' ' } })),
      ),
    );
    const unknown = await failure(
      setup(null).guard.canActivate(ctx(request())),
    );
    expect(missing.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(missing.body.message).toBe(CARRIER_INVALID_KEY_MESSAGE);
    expect(unknown.body.message).toBe(CARRIER_INVALID_KEY_MESSAGE);
    expect(unknown.body.code).toBeUndefined();
  });

  it('juda uzun kalit — bazaga bormasdan 401', async () => {
    const { guard, accounts } = setup(null);
    const res = await failure(
      guard.canActivate(
        ctx(request({ headers: { 'x-api-key': 'bpc_' + 'x'.repeat(400) } })),
      ),
    );
    expect(res.status).toBe(401);
    expect(accounts.validateKey).not.toHaveBeenCalled();
  });

  it('⭐ baza xatosi — 503 CARRIER_KEY_CHECK_UNAVAILABLE (401 EMAS, yopiq qoladi)', async () => {
    const { guard } = setup(new Error('connection refused'));
    const req = request();
    const res = await failure(guard.canActivate(ctx(req)));
    expect(res.status).toBe(503);
    expect(res.body.code).toBe(CARRIER_ERROR_CODES.KEY_CHECK_UNAVAILABLE);
    expect(req.carrier).toBeUndefined();
  });

  it("o'chirilgan (is_active=false) akkaunt — 403", async () => {
    const { guard, accounts } = setup({
      account: account({ is_active: false }),
      courierActive: true,
    });
    const res = await failure(guard.canActivate(ctx(request())));
    expect(res.status).toBe(403);
    expect(res.body.code).toBeUndefined();
    expect(accounts.touchLastUsed).not.toHaveBeenCalled();
  });

  it('⭐ bog‘langan kuryer faol emas — 403 CARRIER_COURIER_INACTIVE', async () => {
    const { guard, accounts } = setup({
      account: account(),
      courierActive: false,
    });
    const req = request();
    const res = await failure(guard.canActivate(ctx(req)));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(CARRIER_ERROR_CODES.COURIER_INACTIVE);
    expect(req.carrier).toBeUndefined();
    expect(accounts.touchLastUsed).not.toHaveBeenCalled();
  });

  it('⭐ IP tekshiruvi kuryer holatidan OLDIN — ruxsatsiz IP kuryer holatini bilmaydi', async () => {
    const { guard } = setup({
      account: account({ ip_allowlist: ['198.51.100.0/24'] }),
      courierActive: false,
    });
    const res = await failure(guard.canActivate(ctx(request())));
    expect(res.status).toBe(403);
    expect(res.body.code).toBeUndefined();
    expect(res.body.message).toBe('IP ruxsat etilmagan: 203.0.113.10');
  });

  it("IP allowlist: req.ip (::ffff: prefiksli ham) ro'yxatda — o'tadi", async () => {
    const { guard } = setup({
      account: account({ ip_allowlist: ['203.0.113.0/24'] }),
      courierActive: true,
    });
    await expect(
      guard.canActivate(ctx(request({ ip: '::ffff:203.0.113.10' }))),
    ).resolves.toBe(true);
  });

  it('⭐ CF-Connecting-IP / X-Forwarded-For sarlavhasiga ISHONMAYDI — faqat req.ip', async () => {
    // BeePost oldida Cloudflare yo'q: bu sarlavhalarni mijoz o'zi yozadi.
    const { guard } = setup({
      account: account({ ip_allowlist: ['198.51.100.7'] }),
      courierActive: true,
    });
    const res = await failure(
      guard.canActivate(
        ctx(
          request({
            ip: '203.0.113.10',
            headers: {
              'x-api-key': 'bpc_secret',
              'cf-connecting-ip': '198.51.100.7',
              'x-forwarded-for': '198.51.100.7',
            },
          }),
        ),
      ),
    );
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('203.0.113.10');
  });

  it("IP aniqlanmasa va ro'yxat bor — 403 'aniqlanmadi'", async () => {
    const { guard } = setup({
      account: account({ ip_allowlist: ['203.0.113.10'] }),
      courierActive: true,
    });
    const res = await failure(
      guard.canActivate(ctx(request({ ip: undefined }))),
    );
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('IP ruxsat etilmagan: aniqlanmadi');
  });

  it('takroriy sarlavha (massiv) — birinchisi olinadi', async () => {
    const { guard, accounts } = setup({
      account: account(),
      courierActive: true,
    });
    await guard.canActivate(
      ctx(request({ headers: { 'x-api-key': ['bpc_a', 'bpc_b'] } })),
    );
    expect(accounts.validateKey).toHaveBeenCalledWith('bpc_a');
  });
});

describe('CarrierApiKeyGuard — kanonik yo‘l (IP ro‘yxatini chetlab o‘tish)', () => {
  it('⭐ katta harfli yo‘l (nginx carrier blokidan tashqari) — 404, kalit tekshirilmaydi', async () => {
    const { guard, accounts } = setup({
      account: account({ ip_allowlist: ['203.0.113.10'] }),
      courierActive: true,
    });
    for (const originalUrl of [
      '/api/v1/CARRIER/ping',
      '/api/v1/Carrier/orders/x/status',
      '/API/V1/carrier/ping',
      '/Api/v1/carrier/cashbox?from=2026-11-01',
    ]) {
      // Soxta XFF Express'da `req.ip` bo'lib keladi — ro'yxatdagi IP.
      const res = await failure(
        guard.canActivate(ctx(request({ originalUrl, ip: '203.0.113.10' }))),
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('/api/v1/carrier/');
    }
    expect(accounts.validateKey).not.toHaveBeenCalled();
  });

  it('yo‘l ma’lumoti umuman yo‘q — yopiq qoladi (404)', async () => {
    const { guard, accounts } = setup({
      account: account(),
      courierActive: true,
    });
    const res = await failure(
      guard.canActivate(ctx(request({ originalUrl: undefined }))),
    );
    expect(res.status).toBe(404);
    expect(accounts.validateKey).not.toHaveBeenCalled();
  });

  it('kanonik prefiksdan keyingi qism registri ahamiyatsiz; `url` zaxira', () => {
    expect(
      isCanonicalCarrierPath({ originalUrl: '/api/v1/carrier/ping' }),
    ).toBe(true);
    // nginx `location /api/v1/carrier/` prefiksi mos keladi — XFF qayta yoziladi.
    expect(
      isCanonicalCarrierPath({ originalUrl: '/api/v1/carrier/PING' }),
    ).toBe(true);
    expect(
      isCanonicalCarrierPath({ url: '/api/v1/carrier/orders?page=1' }),
    ).toBe(true);
    expect(isCanonicalCarrierPath({ originalUrl: '/api/v1/carriers/x' })).toBe(
      false,
    );
    expect(
      isCanonicalCarrierPath({ originalUrl: '/api/v1/%63arrier/ping' }),
    ).toBe(false);
  });
});
