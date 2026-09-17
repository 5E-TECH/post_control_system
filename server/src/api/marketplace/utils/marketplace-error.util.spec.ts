import {
  classifyMarketplaceError,
  MarketplaceCircuitBreaker,
} from './marketplace-error.util';

const httpErr = (status: number) => ({ response: { status } });
const netErr = (code: string) => ({ code, message: code });

describe('classifyMarketplaceError', () => {
  /**
   * ⚠️ BU FAYLDAGI ENG MUHIM TEST.
   *
   * Bugungi kodda har qanday xato «topilmadi» deb ko'rsatiladi va UI
   * «baribir qo'shilsinmi?» deb so'raydi. Marketplace o'lganda operator
   * butun qopni bo'sh buyurtma qilib qo'shib yuboradi (reja §15 #1).
   *
   * Qoida: `allowManualAdd` FAQAT haqiqiy 404 da `true`.
   */
  it("qo'lda qo'shishga FAQAT 404 da ruxsat beradi", () => {
    expect(classifyMarketplaceError(httpErr(404)).allowManualAdd).toBe(true);

    for (const e of [
      httpErr(500),
      httpErr(502),
      httpErr(401),
      httpErr(403),
      httpErr(400),
      httpErr(429),
      netErr('ECONNREFUSED'),
      netErr('ETIMEDOUT'),
      netErr('ENOTFOUND'),
      {},
    ]) {
      const info = classifyMarketplaceError(e);
      expect(info.allowManualAdd).toBe(false);
    }
  });

  it('404 ni «topilmadi» deb tasniflaydi va breakerga sanamaydi', () => {
    const info = classifyMarketplaceError(httpErr(404));
    expect(info.kind).toBe('not_found');
    // Ular ISHLAYAPTI — bu normal javob, navbatni to'xtatish shart emas.
    expect(info.countsTowardBreaker).toBe(false);
    expect(info.retryable).toBe(false);
  });

  it('401 ni SOZLAMA muammosi deb ajratadi', () => {
    const info = classifyMarketplaceError(httpErr(401));
    expect(info.kind).toBe('auth');
    // Operator «posilka yo'q» deb o'ylamasligi uchun xabar aniq bo'lishi kerak.
    expect(info.message).toMatch(/posilka muammosi EMAS/i);
    expect(info.retryable).toBe(false);
  });

  it('5xx da posilka ularda BOR bo\'lishi mumkinligini aytadi', () => {
    const info = classifyMarketplaceError(httpErr(503));
    expect(info.kind).toBe('remote_down');
    expect(info.message).toMatch(/BOR bo'lishi mumkin/);
    expect(info.retryable).toBe(true);
  });

  it('timeout va tarmoq xatolarini ajratadi', () => {
    expect(classifyMarketplaceError(netErr('ECONNABORTED')).kind).toBe('timeout');
    expect(classifyMarketplaceError({ message: 'timeout of 15000ms exceeded' }).kind).toBe('timeout');
    expect(classifyMarketplaceError(netErr('ECONNREFUSED')).kind).toBe('network');
    expect(classifyMarketplaceError(netErr('ENOTFOUND')).kind).toBe('network');
  });

  it('429 ni alohida tasniflaydi va qayta urinishga ruxsat beradi', () => {
    const info = classifyMarketplaceError(httpErr(429));
    expect(info.kind).toBe('rate_limited');
    expect(info.retryable).toBe(true);
  });
});

describe('MarketplaceCircuitBreaker', () => {
  it('3 ketma-ket xatodan keyin navbatni to\'xtatadi', () => {
    const b = new MarketplaceCircuitBreaker(3, 60_000);
    const down = classifyMarketplaceError(httpErr(500));

    expect(b.recordFailure(down, 1000)).toBe(false);
    expect(b.recordFailure(down, 1001)).toBe(false);
    expect(b.recordFailure(down, 1002)).toBe(true); // uchinchisi — to'xtadi
    expect(b.isOpen(1003)).toBe(true);
  });

  it('404 lar breakerni OCHMAYDI', () => {
    // Operator ketma-ket 10 ta noma'lum yorliqni skanerlashi mumkin —
    // bu marketplace o'lgani degani emas, navbat to'xtamasligi kerak.
    const b = new MarketplaceCircuitBreaker(3, 60_000);
    const nf = classifyMarketplaceError(httpErr(404));
    for (let i = 0; i < 10; i++) expect(b.recordFailure(nf, 1000 + i)).toBe(false);
    expect(b.isOpen(2000)).toBe(false);
  });

  it('muvaffaqiyatli skan hisoblagichni nolga qaytaradi', () => {
    const b = new MarketplaceCircuitBreaker(3, 60_000);
    const down = classifyMarketplaceError(httpErr(500));
    b.recordFailure(down, 1000);
    b.recordFailure(down, 1001);
    b.recordSuccess();
    expect(b.failures).toBe(0);
    expect(b.recordFailure(down, 1002)).toBe(false); // yana 3 ta kerak
  });

  it("sovish davridan keyin o'zi ochiladi", () => {
    const b = new MarketplaceCircuitBreaker(3, 60_000);
    const down = classifyMarketplaceError(httpErr(500));
    b.recordFailure(down, 1000);
    b.recordFailure(down, 1000);
    b.recordFailure(down, 1000);
    expect(b.isOpen(1000)).toBe(true);
    expect(b.isOpen(30_000)).toBe(true);
    // 60 soniyadan keyin bitta sinov so'roviga ruxsat.
    expect(b.isOpen(61_001)).toBe(false);
  });
});

describe('Retry-After sarlavhasi', () => {
  const at = (headers: Record<string, string>) =>
    classifyMarketplaceError({ response: { status: 429, headers } });

  it('soniyani o\'qiydi', () => {
    // ⚠️ 429 da hamkor AYNAN qancha kutishni aytadi. E'tiborsiz
    // qoldirsak, limitni qayta-qayta urib urinish byudjetini yeymiz.
    expect(at({ 'retry-after': '120' }).retryAfterMs).toBe(120_000);
  });

  it('HTTP SANANI ham o\'qiydi', () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const ms = at({ 'retry-after': future }).retryAfterMs ?? 0;
    expect(ms).toBeGreaterThan(50_000);
    expect(ms).toBeLessThanOrEqual(60_000);
  });

  it('o\'tib ketgan sana — 0', () => {
    const past = new Date(Date.now() - 60_000).toUTCString();
    expect(at({ 'retry-after': past }).retryAfterMs).toBe(0);
  });

  it('1 soatdan ortiq kutish CHEKLANADI', () => {
    // Mantiqsiz qiymat bilan navbat abadiy to'xtab qolmasin.
    expect(at({ 'retry-after': '99999' }).retryAfterMs).toBe(3_600_000);
  });

  it('yaroqsiz yoki yo\'q — null (odatdagi backoff)', () => {
    expect(at({ 'retry-after': 'axlat' }).retryAfterMs).toBeNull();
    expect(at({}).retryAfterMs).toBeNull();
  });
});
