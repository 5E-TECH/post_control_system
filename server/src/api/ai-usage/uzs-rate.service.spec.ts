import { UzsRateService } from './uzs-rate.service';

/**
 * CBU javobini kursga aylantirish (parseRate) — sof funksiya, tarmoq kerak emas.
 */
describe('UzsRateService.parseRate', () => {
  it('CBU standart massiv javobidan USD kursini ajratadi', () => {
    const data = [
      { Ccy: 'USD', Rate: '11789.33', Date: '08.09.2026', Diff: '4.03' },
    ];
    expect(UzsRateService.parseRate(data)).toBeCloseTo(11789.33, 2);
  });

  it('bir nechta valyuta ichidan aynan USD ni topadi', () => {
    const data = [
      { Ccy: 'EUR', Rate: '13500.00' },
      { Ccy: 'USD', Rate: '11800.5' },
      { Ccy: 'RUB', Rate: '130.2' },
    ];
    expect(UzsRateService.parseRate(data)).toBeCloseTo(11800.5, 2);
  });

  it('bitta obyekt (massiv emas) ham qabul qilinadi', () => {
    expect(UzsRateService.parseRate({ Ccy: 'USD', Rate: '12000' })).toBe(12000);
  });

  it('kichik harfli maydonlar (ccy/rate) bilan ham ishlaydi', () => {
    expect(UzsRateService.parseRate([{ ccy: 'usd', rate: '11500' }])).toBe(
      11500,
    );
  });

  it('USD topilmasa 0 qaytaradi', () => {
    expect(UzsRateService.parseRate([{ Ccy: 'EUR', Rate: '13500' }])).toBe(0);
  });

  it('buzuq/bo‘sh javobda 0 qaytaradi (fallbackga o‘tadi)', () => {
    expect(UzsRateService.parseRate(null)).toBe(0);
    expect(UzsRateService.parseRate([])).toBe(0);
    expect(UzsRateService.parseRate([{ Ccy: 'USD', Rate: 'abc' }])).toBe(0);
    expect(UzsRateService.parseRate([{ Ccy: 'USD', Rate: '-5' }])).toBe(0);
  });
});
