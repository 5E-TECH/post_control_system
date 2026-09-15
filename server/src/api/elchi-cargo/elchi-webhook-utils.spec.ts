/// <reference types="jest" />
import { createHmac } from 'crypto';
import { verifyElchiSignature } from './utils/elchi-signature.util';
import {
  mapElchiStatus,
  normalizeElchiStatus,
} from './utils/elchi-status.mapper';
import { Order_status } from 'src/common/enums';

const SECRET = 'topsecret';
const OLD_SECRET = 'oldsecret';
const sign = (body: string, secret: string) =>
  createHmac('sha256', secret).update(body, 'utf8').digest('hex');

describe('verifyElchiSignature', () => {
  const body = '{"event":"shipment.status_changed","status":"sold"}';

  it("to'g'ri imzo -> valid", () => {
    const res = verifyElchiSignature(body, sign(body, SECRET), SECRET, null);
    expect(res.valid).toBe(true);
    expect(res.usedPreviousSecret).toBeUndefined();
  });

  it('eski sekret (rotatsiya oynasi) -> valid + bayroq', () => {
    const res = verifyElchiSignature(
      body,
      sign(body, OLD_SECRET),
      SECRET,
      OLD_SECRET,
    );
    expect(res.valid).toBe(true);
    expect(res.usedPreviousSecret).toBe(true);
  });

  it('`sha256=` prefiksi bilan ham qabul qiladi', () => {
    const res = verifyElchiSignature(
      body,
      `sha256=${sign(body, SECRET)}`,
      SECRET,
      null,
    );
    expect(res.valid).toBe(true);
  });

  // Imzo AYNAN xom baytlar ustidan — bir belgi o'zgarsa ham yiqilishi shart.
  it("tana o'zgargan bo'lsa -> yiqiladi", () => {
    const res = verifyElchiSignature(
      body.replace('sold', 'cancelled'),
      sign(body, SECRET),
      SECRET,
      null,
    );
    expect(res.valid).toBe(false);
  });

  it("imzo yo'q -> yiqiladi", () => {
    expect(verifyElchiSignature(body, '', SECRET, null).valid).toBe(false);
  });

  it('sekret sozlanmagan -> yiqiladi (ochiq sabab bilan)', () => {
    const res = verifyElchiSignature(body, sign(body, SECRET), null, null);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/sozlanmagan/);
  });

  it("hex bo'lmagan imzo -> yiqiladi (jimgina qisqartirilmaydi)", () => {
    const res = verifyElchiSignature(body, 'zzzz', SECRET, null);
    expect(res.valid).toBe(false);
  });
});

describe('mapElchiStatus', () => {
  it('oraliq statuslar terminal EMAS', () => {
    for (const s of ['created', 'new', 'received']) {
      const m = mapElchiStatus(s)!;
      expect(m.order_status).toBe(Order_status.ON_THE_ROAD);
      expect(m.terminal_action).toBeNull();
    }
    for (const s of ['on the road', 'waiting_customer']) {
      const m = mapElchiStatus(s)!;
      expect(m.order_status).toBe(Order_status.WAITING);
      expect(m.terminal_action).toBeNull();
    }
  });

  it('⭐ `waiting` — ROLLBACK amali, lekin SHARTLI (qabul mezoni №5)', () => {
    /**
     * `waiting` IKKI XIL ma'noda keladi:
     *   oldinga — kuryer pochtani qabul qildi (oddiy oqim);
     *   orqaga  — Elchi sotilgan buyurtmani qaytardi.
     *
     * Ilgari `terminal_action: null` edi, ya'ni rollback UMUMAN
     * qo'llanmasdi: PCS'da buyurtma SOLD qolardi, pul kassada qolardi,
     * Elchi'da esa WAITING — hech kim bilmasdi.
     *
     * Endi amal bor, lekin ajratish `markRolledBackByElchi` ichida:
     * faqat BIZDA sotilgan bo'lsa qaytariladi, aks holda `skipped`.
     * Shu bois oddiy oqim BUZILMAYDI.
     */
    const m = mapElchiStatus('waiting')!;
    expect(m.order_status).toBe(Order_status.WAITING);
    expect(m.terminal_action).toBe('rollback');
    // Terminal EMAS: buyurtma yana sotilishi mumkin (mezon №6).
    expect(m.is_terminal).toBe(false);
  });

  it('sold / paid / partly_paid -> sotuv oqimi', () => {
    for (const s of ['sold', 'paid', 'partly_paid']) {
      const m = mapElchiStatus(s)!;
      expect(m.order_status).toBe(Order_status.SOLD);
      expect(m.terminal_action).toBe('sell');
      expect(m.is_terminal).toBe(true);
    }
  });

  it('cancelled -> bekor qilish oqimi', () => {
    const m = mapElchiStatus('cancelled')!;
    expect(m.order_status).toBe(Order_status.CANCELLED);
    expect(m.terminal_action).toBe('cancel');
  });

  // ⚠️ Bu ikkisi CLOSED EMAS — posilka hali qaytish yo'lida.
  it("cancelled (sent) va returned_to_market -> CANCELLED_SENT, 'return'", () => {
    for (const s of ['cancelled (sent)', 'returned_to_market']) {
      const m = mapElchiStatus(s)!;
      expect(m.order_status).toBe(Order_status.CANCELLED_SENT);
      expect(m.terminal_action).toBe('return');
    }
  });

  it("`closed` ATAYLAB e'tiborga olinmaydi -> null", () => {
    expect(mapElchiStatus('closed')).toBeNull();
  });

  it("noma'lum status -> null (buyurtma tegilmaydi)", () => {
    expect(mapElchiStatus('some_new_status')).toBeNull();
  });

  it('normalizatsiya: katta harf va ortiqcha bo‘shliq', () => {
    expect(normalizeElchiStatus('  ON   THE  ROAD ')).toBe('on the road');
    expect(mapElchiStatus('  SOLD ')!.terminal_action).toBe('sell');
  });

  // MODUL INVARIANTI: hech qanday Elchi statusi bizni CLOSED qila olmaydi.
  // CLOSED faqat skaner oqimidan qo'yiladi (LDG'da aynan shu xato bo'lgan).
  it('HECH BIR status CLOSED bermaydi', () => {
    const all = [
      'created',
      'new',
      'received',
      'on the road',
      'waiting',
      'waiting_customer',
      'sold',
      'paid',
      'partly_paid',
      'cancelled',
      'cancelled (sent)',
      'returned_to_market',
      'closed',
    ];
    for (const s of all) {
      const m = mapElchiStatus(s);
      if (m) expect(m.order_status).not.toBe(Order_status.CLOSED);
    }
  });
});
