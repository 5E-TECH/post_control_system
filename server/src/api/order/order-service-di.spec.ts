/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';

/**
 * `OrderService` BOG'LIQLIKLARI — ISHGA TUSHISH QULFI.
 *
 * ⚠️ NEGA BU TEST BOR. `DashboardModule` `OrderService` ni O'Z provideri
 * sifatida QAYTA e'lon qiladi (`dashboard.module.ts` `providers` ro'yxati),
 * ya'ni NestJS u yerda IKKINCHI nusxasini quradi. Shu sabab `OrderService`
 * konstruktoriga yangi bog'liqlik qo'shilganda, uni beradigan modul
 * `DashboardModule` ga ham import qilinishi SHART.
 *
 * Bu xatoni `tsc` UMUMAN ko'rmaydi va barcha unit testlar ham o'tadi —
 * u faqat server ishga tushayotganda chiqadi:
 *
 *   Nest can't resolve dependencies of the OrderService (... ?).
 *   Please make sure that the argument ExtraCostApplierService at index [16]
 *   is available in the DashboardModule context.
 *
 * Ya'ni xato PRODUCTION DEPLOY paytida ko'rinardi. Shu bois modullar
 * ro'yxatini statik solishtirib turamiz: `OrderService` ni provider qilgan
 * har bir modul `OrderModule` bilan BIR XIL modullarni import qilishi kerak.
 */
const SRC = path.resolve(__dirname, '../..');

function readModule(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

/** Faylning `imports: [...]` blokidagi `XModule` nomlarini ajratadi. */
function importedModules(source: string): Set<string> {
  const block = arrayBlock(source, 'imports');
  return new Set(block.match(/\b[A-Z]\w*Module\b/g) ?? []);
}

/** Qavslarni sanab, `<key>: [ ... ]` massivining matnini ajratadi. */
function arrayBlock(source: string, key: string): string {
  const marker = `${key}: [`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  let depth = 0;
  for (let i = start + marker.length - 1; i < source.length; i++) {
    if (source[i] === '[') depth++;
    else if (source[i] === ']') {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return '';
}

/**
 * `providers: [...]` blokida AYNAN shu nom bormi.
 *
 * ⚠️ `includes()` YETARLI EMAS: `AiOrderService` ichida `OrderService` satri
 * bor va u soxta ijobiy beradi (`order-bot.module.ts` aynan shu sababdan
 * "OrderService ni provider qiladi" deb topilgan edi). So'z chegarasi shart.
 */
function providesService(source: string, name: string): boolean {
  const block = arrayBlock(source, 'providers');
  if (!block) return false;
  return new RegExp(`(^|[^A-Za-z0-9_])${name}([^A-Za-z0-9_]|$)`).test(block);
}

describe("OrderService ni QAYTA e'lon qilgan modullar", () => {
  const orderModule = readModule('api/order/order.module.ts');
  const orderImports = importedModules(orderModule);

  /**
   * `OrderService` ni PROVIDER sifatida qayta e'lon qiladigan modullar.
   * Yangisi qo'shilsa TC3 uni ushlaydi va bu ro'yxatga qo'shish talab qilinadi.
   */
  const REPLICATING_MODULES = ['api/dashboard/dashboard.module.ts'];

  /**
   * `OrderService` KONSTRUKTORIDAGI bog'liqliklarni beradigan modullar.
   *
   * ⚠️ Nega BARCHA importlarni solishtirmaymiz: `OrderModule` ba'zi
   * modullarni boshqa sabablarga ko'ra import qiladi (masalan `CashBoxModule`
   * — uni `OrderService` konstruktori talab qilmaydi). Ularni majburlash
   * SOXTA ogohlantirish bo'lardi. Faqat konstruktor uchun zarurlari.
   */
  const CTOR_DEP_MODULES = [
    'BotModule', // BotService
    'OrderBotModule', // OrderBotService
    'ExternalIntegrationModule', // ExternalIntegrationService
    'IntegrationSyncModule', // IntegrationSyncService
    'ExtraCostModule', // ExtraCostApplierService
    'MarketplaceModule', // MarketplaceSyncService
  ];

  it("TC1: OrderModule konstruktor bog'liqliklarini beruvchi modullarni import qiladi", () => {
    const missing = CTOR_DEP_MODULES.filter((m) => !orderImports.has(m));
    expect(missing).toEqual([]);
  });

  it.each(REPLICATING_MODULES)(
    "TC2: %s ham O'SHA modullarni import qiladi (aks holda server ko'tarilmaydi)",
    (rel) => {
      const src = readModule(rel);
      if (!providesService(src, 'OrderService')) return;

      const theirs = importedModules(src);
      const missing = CTOR_DEP_MODULES.filter((m) => !theirs.has(m));
      expect(missing).toEqual([]);
    },
  );

  it("TC3: OrderService ni provider qiladigan modullar ro'yxati to'liq", () => {
    // Yangi modul `OrderService` ni provider qilsa, u REPLICATING_MODULES ga
    // qo'shilishi kerak — aks holda bu qulf uni qamramaydi va keyingi
    // konstruktor o'zgarishi jimgina production'da yiqiladi.
    //
    // ⚠️ REKURSIV skaner. Avval faqat bir daraja (`api/<dir>/*.module.ts`)
    // ko'rilardi, holbuki loyihada modullar chuqurroq ham yotadi
    // (masalan `api/bots/notify-bot/bot.module.ts`) — ular umuman
    // tekshirilmasdi.
    const found: string[] = [];
    const walk = (absDir: string) => {
      for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
        const abs = path.join(absDir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(abs);
          continue;
        }
        if (!entry.name.endsWith('.module.ts')) continue;
        const rel = path.relative(SRC, abs).split(path.sep).join('/');
        if (rel === 'api/order/order.module.ts') continue;
        if (providesService(readModule(rel), 'OrderService')) found.push(rel);
      }
    };
    walk(path.join(SRC, 'api'));

    expect(found.sort()).toEqual([...REPLICATING_MODULES].sort());
  });
});
