import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESERVED_MARKETPLACE_SLUGS } from './marketplace.enums';

/**
 * MARSHRUT TO'QNASHUVI QULFI.
 *
 * `marketplace/:slug/...` va `marketplace/<literal>/...` bir xil shaklda.
 * Kimdir `@Post('batch/:id')` qo'shsa-yu, `batch` band so'zlar ro'yxatiga
 * tushmasa — `batch` nomli slug yaratilishi mumkin bo'lib qoladi va o'sha
 * ulanishning yo'llari jimgina noto'g'ri controllerga tushadi.
 *
 * Bu test literal segmentlarni KODDAN o'qiydi, shuning uchun yangi route
 * qo'shilganda ro'yxatni yangilashni unutib bo'lmaydi.
 */
const DIR = __dirname;

function routePaths(file: string): string[] {
  const src = readFileSync(join(DIR, file), 'utf8');
  const out: string[] = [];
  const re = /@(?:Get|Post|Patch|Put|Delete)\(\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function controllerPrefix(file: string): string {
  const src = readFileSync(join(DIR, file), 'utf8');
  const m = /@Controller\(\s*'([^']*)'/.exec(src);
  return m ? m[1] : '';
}

describe('Marketplace marshrutlari — slug to\'qnashuvi', () => {
  const reserved = new Set<string>(RESERVED_MARKETPLACE_SLUGS as readonly string[]);

  it("operator controllerdagi har bir literal segment BAND ro'yxatida", () => {
    // `marketplace/:slug/...` shabloni shu controllerda — demak birinchi
    // segment literal bo'lsa, u slug bo'lib qolishi mumkin emas.
    const leaks = routePaths('marketplace.controller.ts')
      .map((p) => p.split('/')[0])
      .filter((seg) => seg && !seg.startsWith(':'))
      .filter((seg) => !reserved.has(seg));

    expect(leaks).toEqual([]);
  });

  it("sozlash controlleri `marketplace/config` prefiksida va `config` band", () => {
    const prefix = controllerPrefix('marketplace-config.controller.ts');
    expect(prefix).toBe('marketplace/config');
    // Prefiks literal bo'lgani uchun ichkaridagi `:slug` operator
    // yo'llariga umuman tegmaydi — lekin `config` nomli slug yaratilsa
    // `marketplace/config/...` ikki ma'noli bo'lardi.
    expect(reserved.has('config')).toBe(true);
  });

  it("sozlash controlleri operator controlleridan OLDIN ro'yxatga olinadi", () => {
    const mod = readFileSync(join(DIR, 'marketplace.module.ts'), 'utf8');
    const block = /controllers:\s*\[([\s\S]*?)\]/.exec(mod);
    expect(block).not.toBeNull();

    const order = (block as RegExpExecArray)[1];
    expect(order.indexOf('MarketplaceConfigController')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('MarketplaceConfigController')).toBeLessThan(
      order.indexOf('MarketplaceController,'),
    );
  });

  it("band so'zlar ro'yxati bo'sh emas va kichik harfda", () => {
    expect(reserved.size).toBeGreaterThan(5);
    for (const s of reserved) expect(s).toBe(s.toLowerCase());
  });
});
