/// <reference types="jest" />
import * as path from 'path';
import {
  PROOF_ALLOWED_MIME,
  PROOF_DIR,
  PROOF_IMAGE_MIME,
  PROOF_MAX_FILES,
  PROOF_MAX_IMAGE_BYTES,
  PROOF_MAX_TOTAL_BYTES,
  PROOF_MAX_VIDEO_BYTES,
  PROOF_MIME_EXT,
  PROOF_VIDEO_MIME,
  ensureProofSubdir,
  isVideoMime,
  resolveProofPath,
} from './proof-storage.const';

/**
 * ISBOT SAQLASH — yo'l va tur qoidalari.
 *
 * Ikkita mustaqil xavf sinaladi:
 *
 *   1. PATH TRAVERSAL. `rel_path` va `stored_name` bazadan keladi, lekin
 *      ularni ko'r-ko'rona `path.join` qilish xavfli: DB'ga qandaydir yo'l
 *      bilan `../../` tushsa, himoyalangan endpoint tizim faylini o'qib
 *      berardi. Chegara PROOF_DIR — undan chiqish MUMKIN EMAS.
 *
 *   2. SAQLANGAN XSS. Fayl bizning domenimizdan beriladi. SVG/HTML ichida
 *      skript bo'lishi mumkin, shuning uchun ular oq ro'yxatda YO'Q va
 *      diskdagi kengaytma klient bergan nomdan EMAS, serverda aniqlangan
 *      MIME'dan olinadi.
 */
describe('Isbot saqlash — path traversal', () => {
  it("TC1: oddiy yo'l PROOF_DIR ichida qoladi", () => {
    const abs = resolveProofPath('2026/09', 'abc.jpg');
    expect(abs).toBe(path.join(PROOF_DIR, '2026', '09', 'abc.jpg'));
    expect(abs.startsWith(PROOF_DIR + path.sep)).toBe(true);
  });

  it('TC2: `..` bilan chiqishga urinish RAD ETILADI (rel_path orqali)', () => {
    expect(() => resolveProofPath('../../../../etc', 'passwd')).toThrow(
      /tashqarida/,
    );
  });

  it('TC3: `..` fayl nomida ham RAD ETILADI', () => {
    expect(() => resolveProofPath('2026/09', '../../../../etc/passwd')).toThrow(
      /tashqarida/,
    );
  });

  it("TC4: mutlaq yo'l berilsa ham chiqib keta olmaydi", () => {
    // `path.resolve` mutlaq segmentni ko'rsa oldingilarini tashlab yuboradi —
    // shuning uchun tekshiruv resolve'dan KEYIN turishi shart.
    expect(() => resolveProofPath('/etc', 'passwd')).toThrow(/tashqarida/);
  });

  it("TC5: bo'sh yo'l PROOF_DIR ning O'ZIGA tushmaydi", () => {
    // Fayl nomi bo'sh bo'lsa natija papkaning o'zi bo'lardi — bu fayl emas.
    expect(() => resolveProofPath('', '')).toThrow(/tashqarida/);
  });
});

describe("Isbot saqlash — oylik bo'lish", () => {
  it("TC6: YYYY/MM formatida nisbiy yo'l qaytaradi", () => {
    const rel = ensureProofSubdir(new Date(Date.UTC(2026, 8, 15)));
    expect(rel).toBe(path.join('2026', '09'));
  });

  it('TC7: yanvar 01 ga to\'ldiriladi (raqam "1" bo\'lib qolmasin)', () => {
    const rel = ensureProofSubdir(new Date(Date.UTC(2027, 0, 3)));
    expect(rel).toBe(path.join('2027', '01'));
  });
});

describe('Isbot saqlash — fayl turlari', () => {
  it('TC8: rasm VA video qabul qilinadi', () => {
    const list = PROOF_ALLOWED_MIME as readonly string[];
    expect(list).toContain('image/jpeg');
    expect(list).toContain('video/mp4');
    expect(list).toContain('video/quicktime'); // iPhone .mov
  });

  it('TC9: SVG va HTML RAD ETILADI — saqlangan XSS vektori', () => {
    const list = PROOF_ALLOWED_MIME as readonly string[];
    expect(list).not.toContain('image/svg+xml');
    expect(list).not.toContain('text/html');
  });

  it('TC10: har bir ruxsat etilgan MIME uchun kengaytma xaritasi BOR', () => {
    // ⚠️ Unutilsa fayl nomi `<uuid>undefined` bo'lib qoladi va fayl
    // kengaytmasiz diskka tushadi.
    for (const mime of PROOF_ALLOWED_MIME) {
      expect(PROOF_MIME_EXT[mime]).toMatch(/^\.[a-z0-9]+$/);
    }
  });

  it("TC11: kengaytma xaritasida oq ro'yxatdan TASHQARI tur yo'q", () => {
    const allowed = new Set<string>(PROOF_ALLOWED_MIME);
    for (const mime of Object.keys(PROOF_MIME_EXT)) {
      expect(allowed.has(mime)).toBe(true);
    }
  });

  it('TC12: `isVideoMime` rasm va videoni to‘g‘ri ajratadi', () => {
    for (const m of PROOF_IMAGE_MIME) expect(isVideoMime(m)).toBe(false);
    for (const m of PROOF_VIDEO_MIME) expect(isVideoMime(m)).toBe(true);
  });
});

describe('Isbot saqlash — MEDIA BYUDJETI', () => {
  it('TC13: video chegarasi rasmnikidan KATTA', () => {
    expect(PROOF_MAX_VIDEO_BYTES).toBeGreaterThan(PROOF_MAX_IMAGE_BYTES);
  });

  it('TC14: JAMI byudjet bitta videodan katta, lekin 5 ta videodan KICHIK', () => {
    // Foydalanuvchi talabining aynan o'zi: "agar 1 ta videoning o'zi limitni
    // to'ldirsa, qolgan 4 tasiga joy yo'q".
    expect(PROOF_MAX_TOTAL_BYTES).toBeGreaterThan(PROOF_MAX_VIDEO_BYTES);
    expect(PROOF_MAX_TOTAL_BYTES).toBeLessThan(
      PROOF_MAX_VIDEO_BYTES * PROOF_MAX_FILES,
    );
  });

  it('TC15: ikkita TO‘LA video byudjetga SIG‘MAYDI', () => {
    expect(PROOF_MAX_VIDEO_BYTES * 2).toBeGreaterThan(PROOF_MAX_TOTAL_BYTES);
  });

  it('TC16: 5 ta TO‘LA rasm byudjetga SIG‘ADI', () => {
    // Rasmlar klientda siqiladi (~300 KB), shuning uchun bu chegara amalda
    // hech qachon urilmasligi kerak.
    expect(PROOF_MAX_IMAGE_BYTES * PROOF_MAX_FILES).toBeLessThanOrEqual(
      PROOF_MAX_TOTAL_BYTES,
    );
  });
});
