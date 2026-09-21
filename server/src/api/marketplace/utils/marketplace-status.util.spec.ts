import {
  buildEventStatus,
  findStatusMapConflicts,
  pcsStatusToCanonical,
  sanitizeStatusMap,
  toCanonicalStatus,
  toPartnerStatus,
} from './marketplace-status.util';
import { MarketplaceParcelStatus } from '../marketplace.enums';

describe('Status xaritasi — bizdan ularga', () => {
  it('sozlangan qiymatni yuboradi', () => {
    expect(toPartnerStatus({ DELIVERED: '7' }, 'DELIVERED')).toBe('7');
  });

  it('sozlanmagan bo\'lsa KANONIK nom ketadi', () => {
    // ⚠️ Bo'sh satr yuborishdan ko'ra kanonik nom ancha yaxshi: hamkor
    // hech bo'lmaganda nima bo'lganini o'qiy oladi.
    expect(toPartnerStatus({ DELIVERED: '7' }, 'CANCELLED')).toBe('CANCELLED');
    expect(toPartnerStatus(null, 'DELIVERED')).toBe('DELIVERED');
    expect(toPartnerStatus({ DELIVERED: '  ' }, 'DELIVERED')).toBe('DELIVERED');
  });

  it('null status — null qaytadi', () => {
    expect(toPartnerStatus({ DELIVERED: '7' }, null)).toBeNull();
  });
});

describe('Status xaritasi — ulardan bizga', () => {
  it('ularning qiymatini KANONIKKA qaytaradi', () => {
    const map = { DELIVERED: '7', VOIDED: 'otmenen' };
    expect(toCanonicalStatus(map, '7')).toBe(MarketplaceParcelStatus.DELIVERED);
    expect(toCanonicalStatus(map, 'otmenen')).toBe(MarketplaceParcelStatus.VOIDED);
  });

  it('xarita yo\'q bo\'lsa kanonik nomni tanidi (registrga befarq)', () => {
    expect(toCanonicalStatus(null, 'delivered')).toBe(
      MarketplaceParcelStatus.DELIVERED,
    );
    expect(toCanonicalStatus({}, 'VOIDED')).toBe(MarketplaceParcelStatus.VOIDED);
  });

  it('noma\'lum qiymat — TAXMIN QILMAYDI', () => {
    // ⚠️ Taxmin qilsak, ular bekor qilgan posilkani «tayyor» deb qabul
    // qilib yuborardik.
    expect(toCanonicalStatus({ DELIVERED: '7' }, '999')).toBeNull();
    expect(toCanonicalStatus(null, '')).toBeNull();
    expect(toCanonicalStatus(null, null)).toBeNull();
  });
});

describe('PCS ichki statusi → kanonik', () => {
  it('ichki qiymatlarni kontrakt lug\'atiga o\'giradi', () => {
    // ⚠️ `waiting` / `on the road` kontrakt §6.1 da YO'Q — hamkor
    // ularni tushunmaydi.
    expect(pcsStatusToCanonical('waiting')).toBe(
      MarketplaceParcelStatus.OUT_FOR_DELIVERY,
    );
    expect(pcsStatusToCanonical('on the road')).toBe(
      MarketplaceParcelStatus.IN_TRANSIT,
    );
    expect(pcsStatusToCanonical('sold')).toBe(MarketplaceParcelStatus.DELIVERED);
    expect(pcsStatusToCanonical('cancelled (sent)')).toBe(
      MarketplaceParcelStatus.CANCELLED,
    );
  });

  it('kanonik qiymat o\'zgarishsiz o\'tadi', () => {
    expect(pcsStatusToCanonical('DELIVERED')).toBe(
      MarketplaceParcelStatus.DELIVERED,
    );
  });

  it('noma\'lum — null', () => {
    expect(pcsStatusToCanonical('allaqanday')).toBeNull();
  });
});

describe('Hodisa status bloki', () => {
  it('ikki qadam: PCS → kanonik → hamkor', () => {
    const r = buildEventStatus({ DELIVERED: '7' }, {
      from: 'waiting',
      to: 'DELIVERED',
    });
    expect(r).toEqual({ from: 'OUT_FOR_DELIVERY', to: '7' });
  });

  it('`to` HECH QACHON null bo\'lmaydi — xom qiymat zaxira', () => {
    // Hodisa `to` siz ma'nosiz: keyin nima bo'lganini aniqlab bo'lmaydi.
    const r = buildEventStatus(null, { from: null, to: 'ALLAQANDAY' });
    expect(r?.to).toBe('ALLAQANDAY');
  });
});

describe('Xaritani tozalash va to\'qnashuv', () => {
  it('kanonik BO\'LMAGAN kalit tashlanadi', () => {
    // ⚠️ Aks holda admin xato yozgan nomni hech narsa ushlamaydi va
    // status jimgina xaritalanmay qolardi.
    expect(sanitizeStatusMap({ DELIVERED: '7', XATO_NOM: '9' })).toEqual({
      DELIVERED: '7',
    });
  });

  it('bo\'sh qiymat tashlanadi, hammasi bo\'sh bo\'lsa null', () => {
    expect(sanitizeStatusMap({ DELIVERED: '  ' })).toBeNull();
    expect(sanitizeStatusMap(null)).toBeNull();
  });

  it('raqam ham SATRGA aylantiriladi', () => {
    // `7` va `"7"` JSON'da ajralmaydi-yu, taqqoslashda TENG EMAS.
    expect(sanitizeStatusMap({ DELIVERED: 7 })).toEqual({ DELIVERED: '7' });
  });

  it('bir qiymat ikki statusga berilsa TO\'QNASHUV', () => {
    const c = findStatusMapConflicts({ DELIVERED: '7', PARTLY_DELIVERED: '7' });
    expect(c).toHaveLength(1);
    expect(c[0].value).toBe('7');
    expect(c[0].statuses.sort()).toEqual(['DELIVERED', 'PARTLY_DELIVERED']);
  });
});
