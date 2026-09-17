import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MarketplaceApiKeyGuard, ipAllowed, assertValidIpAllowlist } from './marketplace-api-key.guard';

const KEY = 'mock-inbound-key-abc123';

const integration = (over: any = {}) => ({
  id: 'int-1',
  slug: 'uzum',
  is_active: true,
  inbound_api_key: KEY,
  ip_allowlist: null,
  ...over,
});

function ctx(req: any) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

const request = (over: any = {}) => ({
  params: { slug: 'uzum' },
  headers: { 'x-api-key': KEY },
  ip: '203.0.113.5',
  ...over,
});

const guard = (found: any) =>
  new MarketplaceApiKeyGuard({ findOne: jest.fn(async () => found) } as any);

describe('MarketplaceApiKeyGuard', () => {
  it("to'g'ri kalit bilan o'tkazadi va integratsiyani biriktiradi", async () => {
    const req = request();
    const integ = integration();
    await expect(guard(integ).canActivate(ctx(req))).resolves.toBe(true);
    // Controller shu orqali `integration_id` bilan cheklaydi.
    expect((req as any).marketplaceIntegration).toBe(integ);
  });

  it('kalit yoki slug yo\'q bo\'lsa 401', async () => {
    await expect(
      guard(integration()).canActivate(ctx(request({ headers: {} }))),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      guard(integration()).canActivate(ctx(request({ params: {} }))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("NOMA'LUM slug va O'CHIRILGAN ulanish AYNI xatoni beradi", async () => {
    // ⚠️ Ataylab ajratilmaydi: aks holda tashqaridan qaysi slug'lar
    // mavjudligini sanab chiqish mumkin bo'lardi.
    const notFound = await guard(null)
      .canActivate(ctx(request()))
      .catch((e) => e);
    const disabled = await guard(integration({ is_active: false }))
      .canActivate(ctx(request()))
      .catch((e) => e);

    expect(notFound).toBeInstanceOf(UnauthorizedException);
    expect(disabled).toBeInstanceOf(UnauthorizedException);
    expect(notFound.message).toBe(disabled.message);
  });

  it("NOTO'G'RI kalitni rad etadi", async () => {
    await expect(
      guard(integration()).canActivate(
        ctx(request({ headers: { 'x-api-key': 'boshqa-kalit' } })),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('har xil UZUNLIKDAGI kalitda yiqilmaydi', async () => {
    // ⚠️ `timingSafeEqual` har xil uzunlikda XATO tashlaydi — guard uni
    // ushlamasa 500 qaytarardi va bu kalit uzunligini oshkor qilardi.
    await expect(
      guard(integration()).canActivate(ctx(request({ headers: { 'x-api-key': 'qisqa' } }))),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      guard(integration()).canActivate(
        ctx(request({ headers: { 'x-api-key': KEY + 'uzunroq' } })),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("kiruvchi kalit sozlanmagan bo'lsa rad etadi", async () => {
    await expect(
      guard(integration({ inbound_api_key: null })).canActivate(ctx(request())),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("IP ro'yxati bo'lsa — faqat ro'yxatdagi IP o'tadi", async () => {
    const integ = integration({ ip_allowlist: ['203.0.113.5'] });
    await expect(guard(integ).canActivate(ctx(request()))).resolves.toBe(true);
    await expect(
      guard(integ).canActivate(ctx(request({ ip: '198.51.100.9' }))),
    ).rejects.toThrow(ForbiddenException);
  });

  it("IPv4-mapped IPv6 manzilni to'g'ri o'qiydi", async () => {
    const integ = integration({ ip_allowlist: ['203.0.113.5'] });
    await expect(
      guard(integ).canActivate(ctx(request({ ip: '::ffff:203.0.113.5' }))),
    ).resolves.toBe(true);
  });

  it("IP ro'yxati bo'sh bo'lsa cheklov yo'q", async () => {
    await expect(
      guard(integration({ ip_allowlist: [] })).canActivate(
        ctx(request({ ip: '1.2.3.4' })),
      ),
    ).resolves.toBe(true);
  });
});

describe('IP oq ro\'yxati — CIDR', () => {
  it('ANIQ manzilga ruxsat beradi', () => {
    expect(ipAllowed('91.212.1.5', ['91.212.1.5'])).toBe(true);
    expect(ipAllowed('91.212.1.6', ['91.212.1.5'])).toBe(false);
  });

  it('CIDR BLOKNI tushunadi', () => {
    // ⚠️ Avval faqat aniq satr taqqoslanardi — hamkor bir nechta
    // chiquvchi IP dan foydalansa, CIDR HECH QACHON mos kelmasdi va
    // u jimgina 403 olardi.
    expect(ipAllowed('91.212.34.7', ['91.212.0.0/16'])).toBe(true);
    expect(ipAllowed('91.213.0.1', ['91.212.0.0/16'])).toBe(false);
    expect(ipAllowed('10.1.2.3', ['10.0.0.0/8'])).toBe(true);
  });

  it('IPv4-mapped IPv6 ni normallashtiradi', () => {
    // Node `req.ip` ni `::ffff:1.2.3.4` shaklida beradi.
    expect(ipAllowed('::ffff:91.212.1.5', ['91.212.1.5'])).toBe(true);
    expect(ipAllowed('::ffff:91.212.34.7', ['91.212.0.0/16'])).toBe(true);
  });

  it('yaroqsiz yozuv SOZLASHDA rad etiladi', () => {
    // Jimgina 403 o'rniga aniq xato.
    expect(() => assertValidIpAllowlist(['91.212.0.'])).toThrow(
      /yaroqsiz yozuv/i,
    );
    expect(() => assertValidIpAllowlist(['10.0.0.0/99'])).toThrow(
      /yaroqsiz yozuv/i,
    );
    expect(() => assertValidIpAllowlist(['91.212.0.0/16', '1.2.3.4'])).not.toThrow();
  });
});
