/// <reference types="jest" />
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { generateCarrierOpenApiDocument } from './carrier-openapi.offline';
import { CARRIER_SWAGGER_GUIDE } from './carrier-swagger';
import {
  CARRIER_ORDER_STATUS_EXAMPLES,
  CARRIER_PUBLIC_ORDER_STATUSES,
  CARRIER_STATUS_INVALID_MESSAGE,
} from './dto/carrier-public.dto';

/**
 * YASHIRIN ROLLBACK — KOMPANIYAGA KO'RINADIGAN MATERIALDA YO'Q (ega
 * qarori 2026-11-14: kompaniya bilan endi ishlay boshlayapmiz, rollback
 * akkaunt bo'yicha sukut o'chiq va hozircha aytilmaydi).
 *
 * Bu test "rollback" so'zi (katta-kichik harfdan qat'i nazar) ochiq
 * materialga TASODIFAN qaytib kirsa yiqiladi: Swagger tavsifi, misol,
 * enum, xato tavsifi, qo'llanma, statik OpenAPI fayli, provayderga
 * beriladigan `CARRIER_API.md`.
 *
 * ⚠️ Imkoniyatni kompaniyaga OCHISH qarori qilinsa — bu testni o'chirish
 * yoki o'zgartirish O'SHA qarorning bir qismi: ro'yxat
 * `docs/integrations/15-carrier-api.md` §12 ("Qayta ochish").
 */

const REPO = path.resolve(__dirname, '../../../..');

/** Kompaniyaga beriladigan / ko'rinadigan fayllar (repo ildiziga nisbatan). */
const PUBLIC_FILES = ['CARRIER_API.md', 'docs/carrier-openapi.json'];

/**
 * ATAYLAB tekshirilMAYDIGAN ichki fayllar — yashirin sozlamani jamoa uchun
 * hujjatlaydi. Hech biri kompaniyaga berilmaydi.
 */
const INTERNAL_ONLY_FILES = [
  'docs/integrations/15-carrier-api.md',
  'DEPLOY-CHECKLIST.md',
];

/** Nomida "carrier" bor hujjatlar shu papkalardan qidiriladi. */
const DOC_DIRS = ['.', 'docs', 'docs/integrations'];

const ROLLBACK_RE = /rollback/i;

/** Topilgan joylar — xato xabarida aniq satr ko'rinsin. */
function hits(text: string): string[] {
  return text
    .split('\n')
    .map((line, i) => `${i + 1}: ${line.trim().slice(0, 160)}`)
    .filter((line) => ROLLBACK_RE.test(line));
}

describe('Yashirin rollback — ochiq materialda yo‘q', () => {
  it('⭐ generatsiya qilingan carrier Swagger hujjati (jonli /carrier-docs ham shu builder’dan)', async () => {
    const doc = await generateCarrierOpenApiDocument();
    expect(hits(JSON.stringify(doc, null, 2))).toEqual([]);
  });

  it('qo‘llanma, misollar, ochiq enum va validatsiya xabari', () => {
    expect(hits(CARRIER_SWAGGER_GUIDE)).toEqual([]);
    expect(hits(JSON.stringify(CARRIER_ORDER_STATUS_EXAMPLES))).toEqual([]);
    expect(hits(CARRIER_PUBLIC_ORDER_STATUSES.join('\n'))).toEqual([]);
    expect(hits(CARRIER_STATUS_INVALID_MESSAGE)).toEqual([]);
  });

  it.each(PUBLIC_FILES)('⭐ %s', (file) => {
    const text = fs.readFileSync(path.join(REPO, file), 'utf8');
    expect({ file, hits: hits(text) }).toEqual({ file, hits: [] });
  });

  it('ichki fayllar ataylab chiqarilgan va ular yashirin sozlamani hujjatlaydi', () => {
    for (const file of INTERNAL_ONLY_FILES) {
      expect(PUBLIC_FILES).not.toContain(file);
      const text = fs.readFileSync(path.join(REPO, file), 'utf8');
      expect({ file, documented: text.includes('rollback_enabled') }).toEqual({
        file,
        documented: true,
      });
    }
  });

  it('⭐ nomida "carrier" bor har hujjat tasniflangan (yangi ochiq hujjat tekshiruvsiz qolmasin)', () => {
    const known = new Set([...PUBLIC_FILES, ...INTERNAL_ONLY_FILES]);
    const found = DOC_DIRS.flatMap((dir) =>
      fs
        .readdirSync(path.join(REPO, dir), { withFileTypes: true })
        .filter((entry) => entry.isFile() && /carrier/i.test(entry.name))
        .map((entry) => path.posix.join(dir, entry.name).replace(/^\.\//, '')),
    );
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((file) => !known.has(file))).toEqual([]);
  });
});
