/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';

/**
 * QAROR MUDDATI — REGRESSIYA QULFI.
 *
 * ⚠️ NEGA MUHIM. Bu muddatlar PUL harakatini boshqaradi: market javob
 * bermasa, belgilangan kundan keyin xarajat AVTOMATIK tasdiqlanib,
 * summa market hisobidan yechiladi.
 *
 * Qulflanayotgan shartnoma (foydalanuvchi qarori):
 *
 *   0-kun  so'rov yaratiladi, marketga Telegram xabari
 *   2-kun  OXIRGI ESLATMA (tugmalari bilan) + «muddati o'tgan» belgisi
 *   3-kun  avtomatik tasdiq, kassa izohida sababi yoziladi
 *
 * ⚠️ ESLATMA SHARTNOMANING AJRALMAS QISMI. Market so'rov yaratilganda
 * BITTA xabar oladi va boshqa hech narsa kelmaydi. Eslatma olib
 * tashlansa, o'tkazib yuborilgan bitta xabar = pulning jimgina
 * yechilishi bo'lib qoladi — ya'ni muammo kuryerdan marketga
 * ko'chirilgan bo'lardi.
 */
const CRON = path.resolve(__dirname, 'extra-cost.cron.ts');
const src = fs.readFileSync(CRON, 'utf8');

/** Izohlarni tashlaydi — test matnni emas, KODNI tekshiradi. */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

const DAY = 24 * 60 * 60 * 1000;

/**
 * `const NOM = 2 * 24 * 60 * 60 * 1000;` dan millisekundni hisoblaydi.
 *
 * Regex o'rniga oddiy kesish: ifoda faqat ko'paytmadan iborat va
 * shakli o'zgarsa test tushunarli xato beradi.
 */
function msConst(name: string): number {
  const at = code.indexOf(`const ${name}`);
  if (at === -1) throw new Error(`${name} topilmadi`);
  const eq = code.indexOf('=', at);
  const semi = code.indexOf(';', eq);
  const parts = code
    .slice(eq + 1, semi)
    .split('*')
    .map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n)))
    throw new Error(`${name} ifodasi kutilmagan shaklda`);
  return parts.reduce((a, b) => a * b, 1);
}

describe('qaror muddati', () => {
  it('eslatma 2-kuni yuboriladi', () => {
    expect(msConst('ESCALATE_AFTER_MS')).toBe(2 * DAY);
  });

  it('avtomatik tasdiq eslatmadan 1 kun keyin (jami 3 kun)', () => {
    expect(msConst('BACKSTOP_AFTER_ESCALATION_MS')).toBe(1 * DAY);
    expect(
      msConst('ESCALATE_AFTER_MS') + msConst('BACKSTOP_AFTER_ESCALATION_MS'),
    ).toBe(3 * DAY);
  });

  /**
   * ⚠️ ESLATMASIZ 3 KUN ADOLATSIZ. Bu test aynan shuni to'sadi:
   * kimdir eslatmani olib tashlab, muddatni qoldirsa — pul bitta
   * o'tkazib yuborilgan xabardan keyin yechiladigan bo'lardi.
   */
  it('eslatma bosqichi marketga Telegram xabari yuboradi', () => {
    const start = code.indexOf('async escalateStale');
    const end = code.indexOf('async backstopApprove');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(code.slice(start, end)).toContain('telegram.sendReminder');
  });

  /**
   * Eslatma yuborish uchun qatorlarning O'ZI kerak — ommaviy `UPDATE`
   * qaysi so'rovlar belgilangani haqida hech narsa qaytarmaydi.
   */
  it('eslatma bosqichi so‘rovlarni o‘qiydi, ko‘r-ko‘rona UPDATE qilmaydi', () => {
    const start = code.indexOf('async escalateStale');
    const end = code.indexOf('async backstopApprove');
    expect(code.slice(start, end)).toContain('getMany()');
  });

  /**
   * 24 soatlik bekor qilish FAQAT `AWAITING_PROOF` ga tegishi kerak —
   * kuryer isbot biriktirmagan holat. Isbot biriktirilgandan keyin
   * (`PENDING`) so'rov BEKOR BO'LMAYDI, u avtomatik tasdiqqa boradi.
   */
  it('24 soatlik bekor qilish faqat isbotsiz so‘rovga tegadi', () => {
    const start = code.indexOf('async voidStaleAwaitingProof');
    const end = code.indexOf('async escalateStale');
    const body = code.slice(start, end);
    expect(body).toContain('AWAITING_PROOF');
    expect(body).not.toContain('ExtraCostStatus.PENDING');
  });
});
