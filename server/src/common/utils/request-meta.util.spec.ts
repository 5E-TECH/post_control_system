import { Request } from 'express';
import { getClientIp, normalizeIp, extractRequestMeta } from './request-meta.util';

const mk = (ip: string, headers: Record<string, any> = {}): Request =>
  ({ ip, headers } as any);

describe('getClientIp (haqiqiy mijoz IP — trust proxy loopback ostida)', () => {
  it('X-Forwarded-For dan haqiqiy mijozni qaytaradi', () => {
    expect(
      getClientIp(mk('213.230.100.5', { 'x-forwarded-for': '213.230.100.5' })),
    ).toBe('213.230.100.5');
  });

  it('req.ip loopback bo\'lsa X-Real-IP zaxirasiga tushadi', () => {
    expect(
      getClientIp(mk('::ffff:127.0.0.1', { 'x-real-ip': '5.144.230.9' })),
    ).toBe('5.144.230.9');
  });

  it('XFF ning ENG O\'NGDAGI (nginx qo\'shgan) qiymatini oladi — soxta chap-qiymatni EMAS', () => {
    // Mijoz "1.1.1.1" ni oldindan qo'shsa ham, nginx haqiqiy IP'ni o'ngga qo'shadi.
    expect(
      getClientIp(
        mk('::ffff:127.0.0.1', { 'x-forwarded-for': '1.1.1.1, 213.230.100.5' }),
      ),
    ).toBe('213.230.100.5');
  });

  it('IPv4-mapped IPv6 (::ffff:) ni normallashtiradi', () => {
    expect(getClientIp(mk('::ffff:78.150.20.3'))).toBe('78.150.20.3');
  });

  it('hech narsa uzatilmasa loopback bo\'lib qoladi (nginx sozlanmagan holat)', () => {
    expect(getClientIp(mk('::ffff:127.0.0.1'))).toBe('127.0.0.1');
  });

  it('req undefined bo\'lsa bo\'sh string qaytaradi', () => {
    expect(getClientIp(undefined)).toBe('');
  });
});

describe('normalizeIp', () => {
  it('::ffff: prefiksini olib tashlaydi', () =>
    expect(normalizeIp('::ffff:10.0.0.1')).toBe('10.0.0.1'));
  it('::1 ni 127.0.0.1 ga aylantiradi', () =>
    expect(normalizeIp('::1')).toBe('127.0.0.1'));
  it('bo\'sh qiymatда bo\'sh qaytaradi', () => expect(normalizeIp('')).toBe(''));
});

describe('extractRequestMeta', () => {
  it('URL-encoded qurilma nomini dekodlaydi (kirill/o\'zbekcha xavfsiz)', () => {
    const meta = extractRequestMeta(
      mk('9.9.9.9', {
        'user-agent': 'Mozilla',
        'x-device-id': 'abc-123',
        'x-device-name': encodeURIComponent('Ali telefoni'),
      }),
    );
    expect(meta).toEqual({
      ip: '9.9.9.9',
      user_agent: 'Mozilla',
      device_id: 'abc-123',
      device_name: 'Ali telefoni',
    });
  });

  it('massiv-XFF va buzuq percent-encoding\'da CRASH bermaydi', () => {
    const meta = extractRequestMeta(
      mk('', {
        'x-forwarded-for': ['5.5.5.5'],
        'x-device-name': '%E0%A4%A', // buzuq encoding
      }),
    );
    expect(meta.ip).toBe('5.5.5.5');
    expect(meta.device_name).toBe('%E0%A4%A'); // xom qiymatga tushadi
  });

  it('req yo\'q bo\'lsa bo\'sh meta qaytaradi', () => {
    expect(extractRequestMeta(undefined)).toEqual({ ip: '', user_agent: '' });
  });
});
