import { of, throwError } from 'rxjs';
import { MarketplaceApiService } from './marketplace-api.service';
import { verifySignatureHeader } from './utils/marketplace-signature.util';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';

const SECRET = 'mock-secret-v1';

function makeIntegration(
  over: Partial<MarketplaceIntegrationEntity> = {},
): MarketplaceIntegrationEntity {
  return {
    slug: 'uzum',
    api_base_url: 'https://api.uzum.uz',
    api_key: 'mock-marketplace-key',
    signing_secret: SECRET,
    signing_secret_previous: null,
    is_active: true,
    request_timeout_ms: 15000,
    ...over,
  } as MarketplaceIntegrationEntity;
}

/** `HttpService` o'rniga — chaqiruvlarni yozib oladi. */
function makeHttp() {
  const calls: Array<{ url: string; body: unknown; config: any }> = [];
  return {
    calls,
    post: jest.fn((url: string, body: unknown, config: any) => {
      calls.push({ url, body, config });
      return of({ data: { ok: true }, status: 200 });
    }),
    get: jest.fn((url: string, config: any) => {
      calls.push({ url, body: undefined, config });
      return of({ data: { ok: true, version: '1.0.0' }, status: 200 });
    }),
  };
}

describe('MarketplaceApiService', () => {
  it('IMZOLANGAN SATR va YUBORILGAN TANA bir xil', async () => {
    // ⚠️ BU FAYLDAGI ENG MUHIM TEST.
    //
    // Agar axios obyektni o'zi serializatsiya qilsa (biz satr emas, obyekt
    // bersak), yuborilgan bayt ketma-ketligi imzolanganidan farq qilishi
    // mumkin — kalit tartibi yoki probel. Natijada imzo HAR SAFAR yiqiladi
    // va sabab «nega» degan savol bilan soatlab qidiriladi.
    const http = makeHttp();
    const svc = new MarketplaceApiService(http as any);
    const integ = makeIntegration();

    await svc.lookupParcel(integ, 'UZM-8842-1');

    const call = http.calls[0];
    expect(typeof call.body).toBe('string'); // obyekt EMAS, satr
    const sig = call.config.headers['X-BeePost-Signature'];
    expect(verifySignatureHeader(sig, call.body as string, [SECRET]).ok).toBe(true);
  });

  it('`ping` ni IMZOLAMAYDI, qolganini imzolaydi', async () => {
    const http = makeHttp();
    const svc = new MarketplaceApiService(http as any);
    const integ = makeIntegration();

    await svc.ping(integ);
    expect(http.calls[0].config.headers['X-BeePost-Signature']).toBeUndefined();

    await svc.lookupParcel(integ, 'UZM-1');
    expect(http.calls[1].config.headers['X-BeePost-Signature']).toBeDefined();
  });

  it('API kalit, so\'rov ID va timeout qo\'yiladi', async () => {
    const http = makeHttp();
    const svc = new MarketplaceApiService(http as any);
    await svc.lookupParcel(makeIntegration({ request_timeout_ms: 9000 }), 'UZM-1');

    const c = http.calls[0].config;
    expect(c.headers['X-Api-Key']).toBe('mock-marketplace-key');
    expect(c.headers['X-Request-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(c.timeout).toBe(9000);
    // Redirect kuzatilmaydi — SSRF uchun ochiq eshik bo'lardi.
    expect(c.maxRedirects).toBe(0);
  });

  it('kalit aylantirish oynasida IKKI imzo yuboradi', async () => {
    const http = makeHttp();
    const svc = new MarketplaceApiService(http as any);
    await svc.lookupParcel(
      makeIntegration({ signing_secret_previous: 'eski-kalit' }),
      'UZM-1',
    );
    expect(http.calls[0].config.headers['X-BeePost-Signature']).toMatch(
      /v1=[0-9a-f]{64},v2=[0-9a-f]{64}/,
    );
  });

  it("o'chirilgan ulanishda so'rov YUBORMAYDI", async () => {
    const http = makeHttp();
    const svc = new MarketplaceApiService(http as any);
    await expect(
      svc.lookupParcel(makeIntegration({ is_active: false }), 'UZM-1'),
    ).rejects.toThrow(/o'chirilgan/);
    expect(http.calls).toHaveLength(0);
  });

  it('ICHKI manzilga so\'rov yubormaydi (SSRF)', async () => {
    const http = makeHttp();
    const svc = new MarketplaceApiService(http as any);
    await expect(
      svc.lookupParcel(
        makeIntegration({ api_base_url: 'https://169.254.169.254' }),
        'UZM-1',
      ),
    ).rejects.toThrow();
    expect(http.calls).toHaveLength(0);
  });

  it('xatoga TASNIF yopishtiradi (matn parse qilinmasin)', async () => {
    const http = makeHttp();
    http.post = jest.fn(() =>
      throwError(() => ({ response: { status: 404 } })),
    ) as any;
    const svc = new MarketplaceApiService(http as any);

    try {
      await svc.lookupParcel(makeIntegration(), 'YOQ');
      fail('xato kutilgan edi');
    } catch (e: any) {
      expect(e.marketplaceError.kind).toBe('not_found');
      // 404 — YAGONA holat, qo'lda qo'shishga ruxsat.
      expect(e.marketplaceError.allowManualAdd).toBe(true);
    }
  });

  it('3 ketma-ket 5xx dan keyin navbatni to\'xtatadi', async () => {
    const http = makeHttp();
    http.post = jest.fn(() =>
      throwError(() => ({ response: { status: 503 } })),
    ) as any;
    const svc = new MarketplaceApiService(http as any);
    const integ = makeIntegration();

    expect(svc.isPaused('uzum')).toBe(false);
    for (let i = 0; i < 3; i++) {
      await svc.lookupParcel(integ, 'UZM-1').catch(() => undefined);
    }
    // Reja §15 #1: marketplace o'lganda operator 60 ta posilkani ketma-ket
    // urinib, 60 ta xato ko'rishi shart emas.
    expect(svc.isPaused('uzum')).toBe(true);
  });

  it('404 lar navbatni TO\'XTATMAYDI', async () => {
    const http = makeHttp();
    http.post = jest.fn(() =>
      throwError(() => ({ response: { status: 404 } })),
    ) as any;
    const svc = new MarketplaceApiService(http as any);
    const integ = makeIntegration({ slug: 'boshqa' });

    for (let i = 0; i < 5; i++) {
      await svc.lookupParcel(integ, 'YOQ').catch(() => undefined);
    }
    // Operator ketma-ket noma'lum yorliqlarni skanerlashi normal holat.
    expect(svc.isPaused('boshqa')).toBe(false);
  });

  it('breaker HAR INTEGRATSIYA uchun alohida', async () => {
    const http = makeHttp();
    http.post = jest.fn(() =>
      throwError(() => ({ response: { status: 500 } })),
    ) as any;
    const svc = new MarketplaceApiService(http as any);

    for (let i = 0; i < 3; i++) {
      await svc.lookupParcel(makeIntegration({ slug: 'a' }), 'X').catch(() => undefined);
    }
    expect(svc.isPaused('a')).toBe(true);
    expect(svc.isPaused('b')).toBe(false); // ikkinchisi ta'sirlanmaydi
  });
});
