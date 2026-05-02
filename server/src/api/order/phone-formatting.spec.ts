/// <reference types="jest" />

/**
 * Frontend tomondagi telefon formatlash mantiqi xuddi shu algoritmni
 * client/src/pages/profile/pages/user-profile/index.tsx va
 * client/src/pages/orders/components/product-info/index.tsx ichida
 * `formatPhoneForDisplay` sifatida ishlatadi.
 *
 * Bu yerda algoritmni isolatsiyalab, kiritilgan turli holatlarda
 * to'g'ri "+998 XX XXX XX XX" formatini berishini tekshiramiz.
 */
function formatPhoneForDisplay(raw?: string | null): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  digits = digits.slice(0, 9);

  const parts: string[] = [];
  if (digits.length >= 2) parts.push(digits.slice(0, 2));
  else if (digits.length > 0) parts.push(digits);

  if (digits.length > 2) {
    const rest = digits.slice(2);
    if (rest.length >= 3) {
      parts.push(rest.slice(0, 3));
      if (rest.length > 3) {
        const rest2 = rest.slice(3);
        if (rest2.length >= 2) {
          parts.push(rest2.slice(0, 2));
          if (rest2.length > 2) parts.push(rest2.slice(2, 4));
        } else {
          parts.push(rest2);
        }
      }
    } else {
      parts.push(rest);
    }
  }
  const grouped = parts.join(' ');
  return grouped ? `+998 ${grouped}` : '+998 ';
}

describe('Phone formatting', () => {
  it('bo\'sh kiritilsa — boshlang\'ich "+998 " qaytadi', () => {
    expect(formatPhoneForDisplay('')).toBe('+998 ');
    expect(formatPhoneForDisplay(null)).toBe('+998 ');
    expect(formatPhoneForDisplay(undefined)).toBe('+998 ');
  });

  it('faqat "+998 " kiritilsa — o\'zi qaytadi', () => {
    expect(formatPhoneForDisplay('+998 ')).toBe('+998 ');
    expect(formatPhoneForDisplay('+998')).toBe('+998 ');
  });

  it('to\'liq raqam +998901234567 — XX XXX XX XX ga formatlanadi', () => {
    expect(formatPhoneForDisplay('+998901234567')).toBe('+998 90 123 45 67');
  });

  it('raqamlardan tashqari belgilar olib tashlanadi', () => {
    expect(formatPhoneForDisplay('+998 (90) 123-45-67')).toBe(
      '+998 90 123 45 67',
    );
    expect(formatPhoneForDisplay('abc 998 90def 123 45 67xyz')).toBe(
      '+998 90 123 45 67',
    );
  });

  it('9 ta raqamdan ortig\'i kesib tashlanadi', () => {
    expect(formatPhoneForDisplay('+9989012345678999')).toBe(
      '+998 90 123 45 67',
    );
  });

  it('qisman kiritilgan raqamlar progressivly formatlanadi', () => {
    expect(formatPhoneForDisplay('+998 9')).toBe('+998 9');
    expect(formatPhoneForDisplay('+998 90')).toBe('+998 90');
    expect(formatPhoneForDisplay('+998 901')).toBe('+998 90 1');
    expect(formatPhoneForDisplay('+998 9012')).toBe('+998 90 12');
    expect(formatPhoneForDisplay('+998 90123')).toBe('+998 90 123');
    expect(formatPhoneForDisplay('+998 901234')).toBe('+998 90 123 4');
    expect(formatPhoneForDisplay('+998 9012345')).toBe('+998 90 123 45');
    expect(formatPhoneForDisplay('+998 90123456')).toBe('+998 90 123 45 6');
    expect(formatPhoneForDisplay('+998 901234567')).toBe('+998 90 123 45 67');
  });

  it('faqat 9 ta raqam (kod yo\'q) kiritilsa — ham formatlanadi', () => {
    expect(formatPhoneForDisplay('901234567')).toBe('+998 90 123 45 67');
  });

  it('foydalanuvchi backspace bossa — formatlanish ortga qarab ham ishlaydi', () => {
    // "+998 90 123 45 6" ni qaytadan formatlasak — xuddi o'zi qaytishi kerak
    expect(formatPhoneForDisplay('+998 90 123 45 6')).toBe(
      '+998 90 123 45 6',
    );
  });
});
