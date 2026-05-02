/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common';

/**
 * Unit testlar — order.service.ts ichidagi operator telefon raqami mantiqini
 * sof funksiya sifatida tekshiradi. Mantiq createOrder() ichida inline yozilgan,
 * shuning uchun bu yerda xuddi o'sha algoritmni isolatsiyalab olib testlaymiz.
 *
 * Maqsad: 4 ta scenariy 4 ta natija berishini tasdiqlash:
 *   1) require=false                      → default 1-raqam, form input — 2-raqam
 *   2) require=true + default bor         → default 1-raqam, form input — ixtiyoriy 2-raqam
 *   3) require=true + default yo'q + form bor    → form input 1-raqam bo'ladi
 *   4) require=true + default yo'q + form yo'q   → BadRequestException
 */
function resolveOperatorPhones(opts: {
  requireOperatorPhone: boolean;
  marketDefaultPhone?: string | null;
  formOperatorPhone?: string | null;
  formSecondaryOperatorPhone?: string | null;
}): { primary: string | null; secondary: string | null } {
  const formInputPhone =
    opts.formOperatorPhone?.trim() ||
    opts.formSecondaryOperatorPhone?.trim() ||
    '';
  const marketDefaultPhone = opts.marketDefaultPhone?.trim() || '';

  let finalOperatorPhone: string | null;
  let finalSecondaryOperatorPhone: string | null;

  if (opts.requireOperatorPhone) {
    if (marketDefaultPhone) {
      finalOperatorPhone = marketDefaultPhone;
      finalSecondaryOperatorPhone =
        formInputPhone && formInputPhone !== marketDefaultPhone
          ? formInputPhone
          : null;
    } else {
      if (!formInputPhone) {
        throw new BadRequestException(
          'Operator telefon raqami majburiy. Iltimos, market profilida default operator raqamini kiriting yoki buyurtma yaratishda raqam kiriting.',
        );
      }
      finalOperatorPhone = formInputPhone;
      finalSecondaryOperatorPhone = null;
    }
  } else {
    finalOperatorPhone = marketDefaultPhone || null;
    finalSecondaryOperatorPhone =
      formInputPhone && formInputPhone !== finalOperatorPhone
        ? formInputPhone
        : null;
  }

  return {
    primary: finalOperatorPhone,
    secondary: finalSecondaryOperatorPhone,
  };
}

describe('Operator phone resolution', () => {
  describe('require=false (toggle OFF)', () => {
    it('default va form input ikkalasi ham bo\'lsa — default 1-raqam, form 2-raqam', () => {
      const r = resolveOperatorPhones({
        requireOperatorPhone: false,
        marketDefaultPhone: '+998901112233',
        formOperatorPhone: '+998904445566',
      });
      expect(r.primary).toBe('+998901112233');
      expect(r.secondary).toBe('+998904445566');
    });

    it('faqat default bo\'lsa — 1-raqam default, 2-raqam null', () => {
      const r = resolveOperatorPhones({
        requireOperatorPhone: false,
        marketDefaultPhone: '+998901112233',
      });
      expect(r.primary).toBe('+998901112233');
      expect(r.secondary).toBeNull();
    });

    it('hech narsa bo\'lmasa — ikkala raqam ham null', () => {
      const r = resolveOperatorPhones({
        requireOperatorPhone: false,
      });
      expect(r.primary).toBeNull();
      expect(r.secondary).toBeNull();
    });

    it('default va form bir xil bo\'lsa — 2-raqam takrorlanmaydi', () => {
      const r = resolveOperatorPhones({
        requireOperatorPhone: false,
        marketDefaultPhone: '+998901112233',
        formOperatorPhone: '+998901112233',
      });
      expect(r.primary).toBe('+998901112233');
      expect(r.secondary).toBeNull();
    });
  });

  describe('require=true (toggle ON) + default bor', () => {
    it('form bo\'sh bo\'lsa — default 1-raqam, 2-raqam null', () => {
      const r = resolveOperatorPhones({
        requireOperatorPhone: true,
        marketDefaultPhone: '+998901112233',
      });
      expect(r.primary).toBe('+998901112233');
      expect(r.secondary).toBeNull();
    });

    it('form to\'ldirilgan bo\'lsa — default 1-raqam, form 2-raqam', () => {
      const r = resolveOperatorPhones({
        requireOperatorPhone: true,
        marketDefaultPhone: '+998901112233',
        formOperatorPhone: '+998904445566',
      });
      expect(r.primary).toBe('+998901112233');
      expect(r.secondary).toBe('+998904445566');
    });

    it('form va default bir xil — takrorlanmaydi', () => {
      const r = resolveOperatorPhones({
        requireOperatorPhone: true,
        marketDefaultPhone: '+998901112233',
        formOperatorPhone: '+998901112233',
      });
      expect(r.primary).toBe('+998901112233');
      expect(r.secondary).toBeNull();
    });

    it('faqat secondary_operator_phone berilsa — u 2-raqam bo\'ladi', () => {
      const r = resolveOperatorPhones({
        requireOperatorPhone: true,
        marketDefaultPhone: '+998901112233',
        formSecondaryOperatorPhone: '+998904445566',
      });
      expect(r.primary).toBe('+998901112233');
      expect(r.secondary).toBe('+998904445566');
    });
  });

  describe('require=true (toggle ON) + default yo\'q', () => {
    it('form to\'ldirilgan bo\'lsa — form 1-raqam bo\'ladi, 2-raqam null', () => {
      const r = resolveOperatorPhones({
        requireOperatorPhone: true,
        formOperatorPhone: '+998904445566',
      });
      expect(r.primary).toBe('+998904445566');
      expect(r.secondary).toBeNull();
    });

    it('form ham, default ham yo\'q — BadRequestException', () => {
      expect(() =>
        resolveOperatorPhones({
          requireOperatorPhone: true,
        }),
      ).toThrow(BadRequestException);
    });

    it('form bo\'sh string — BadRequestException', () => {
      expect(() =>
        resolveOperatorPhones({
          requireOperatorPhone: true,
          formOperatorPhone: '   ',
        }),
      ).toThrow(BadRequestException);
    });

    it('default bo\'sh string ham hisobga olinadi', () => {
      expect(() =>
        resolveOperatorPhones({
          requireOperatorPhone: true,
          marketDefaultPhone: '   ',
        }),
      ).toThrow(BadRequestException);
    });
  });
});
