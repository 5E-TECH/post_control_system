/// <reference types="jest" />
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { ROLES_KEY } from 'src/common/decorator/roles.decorator';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/enums';
import { CarrierAdminController } from './carrier-admin.controller';

/**
 * CARRIER API — STATIK ULANISH QULFI.
 *
 * Bu xatolarni `tsc` ham, unit testlar ham KO'RMAYDI — ular faqat server
 * ishga tushganda yoki productionda chiqadi:
 *   - `@AcceptRoles` siz admin handler: `RolesGuard` fail-closed → hamma 403;
 *   - public controllerdan guard/filtr tushib qolsa: kalitsiz kirish yoki
 *     kontraktga zid xato konverti (kodsiz, trace_id siz);
 *   - `OrderService` konstruktoriga bog'liqlik qo'shilsa: `DashboardModule`
 *     dagi ikkinchi nusxa boot'da yiqiladi (B10, `order-service-di.spec.ts`);
 *   - `PostModule` `PostService` ni eksport qilmasa: `CarrierModule` boot'da
 *     "can't resolve dependencies" bilan yiqiladi.
 *
 * Fayllar MATN sifatida o'qiladi (public controller import qilinmaydi) —
 * shu sabab bu qulf boshqa fayllar hali kompilyatsiya bo'lmasa ham ishlaydi.
 */
const SRC = path.resolve(__dirname, '../..');
const read = (rel: string): string =>
  fs.readFileSync(path.join(SRC, rel), 'utf8');
const exists = (rel: string): boolean => fs.existsSync(path.join(SRC, rel));

/** `<key>: [ ... ]` massivining ichki matni (qavslarni sanab). */
function arrayBlock(source: string, key: string): string {
  const marker = `${key}: [`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  let depth = 0;
  for (let i = start + marker.length - 1; i < source.length; i++) {
    if (source[i] === '[') depth++;
    else if (source[i] === ']') {
      depth--;
      if (depth === 0) return source.slice(start + marker.length, i);
    }
  }
  return '';
}

/** Massivdagi identifikatorlar tartib bilan (izohlar olib tashlanadi). */
function identifiers(block: string): string[] {
  return (
    block
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .match(/\b[A-Z]\w*\b/g) ?? []
  );
}

/** Class e'lonidan oldingi dekorator bloki. */
function classDecorators(source: string, className: string): string {
  const idx = source.indexOf(`export class ${className}`);
  if (idx === -1) return '';
  const head = source.slice(0, idx);
  const lastDocEnd = head.lastIndexOf('*/');
  return head.slice(lastDocEnd === -1 ? 0 : lastDocEnd + 2);
}

describe('CarrierModule ulanishi', () => {
  const mod = read('api/carrier/carrier.module.ts');

  it('controllerlar tartibi: admin, keyin public', () => {
    expect(identifiers(arrayBlock(mod, 'controllers'))).toEqual([
      'CarrierAdminController',
      'CarrierPublicController',
    ]);
  });

  it('providerlar to‘liq va OrderService/PostService QAYTA e’lon qilinmagan (B10)', () => {
    const providers = identifiers(arrayBlock(mod, 'providers'));
    expect(providers).toEqual(
      expect.arrayContaining([
        'CarrierAccountService',
        'CarrierIdempotencyService',
        'CarrierService',
        'CarrierIpThrottlerGuard',
        'CarrierApiKeyGuard',
        'CarrierThrottlerGuard',
      ]),
    );
    expect(providers).not.toContain('OrderService');
    expect(providers).not.toContain('PostService');
  });

  it('OrderModule va PostModule import qilinadi (servislar eksport orqali)', () => {
    const imports = identifiers(arrayBlock(mod, 'imports'));
    expect(imports).toEqual(
      expect.arrayContaining(['OrderModule', 'PostModule']),
    );
  });

  it('AppModule CarrierModule ni import qiladi', () => {
    expect(
      identifiers(arrayBlock(read('api/app.module.ts'), 'imports')),
    ).toContain('CarrierModule');
  });

  it("⭐ PostModule PostService ni eksport qiladi va CarrierModule ni import QILMAYDI (aylanma yo'q)", () => {
    const post = read('api/post/post.module.ts');
    expect(identifiers(arrayBlock(post, 'exports'))).toContain('PostService');
    expect(identifiers(arrayBlock(post, 'imports'))).not.toContain(
      'CarrierModule',
    );
  });
});

describe('CarrierAdminController — RBAC', () => {
  const proto = CarrierAdminController.prototype as unknown as Record<
    string,
    unknown
  >;
  const handlers = Object.getOwnPropertyNames(proto).filter(
    (name) =>
      name !== 'constructor' &&
      Reflect.getMetadata(METHOD_METADATA, proto[name] as object) !== undefined,
  );

  it('class darajasida JwtGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, CarrierAdminController);
    expect(guards).toEqual([JwtGuard, RolesGuard]);
    expect(Reflect.getMetadata(PATH_METADATA, CarrierAdminController)).toBe(
      'carrier-accounts',
    );
  });

  it('6 ta route: create, list, update, rotateKey, setActive, remove', () => {
    expect(handlers.sort()).toEqual(
      ['create', 'list', 'remove', 'rotateKey', 'setActive', 'update'].sort(),
    );
  });

  it.each(['create', 'list', 'update', 'rotateKey', 'setActive', 'remove'])(
    '⭐ %s — o‘z @AcceptRoles(SUPERADMIN, ADMIN) dekoratoriga ega',
    (name) => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto[name] as object);
      expect(roles).toEqual([Roles.SUPERADMIN, Roles.ADMIN]);
    },
  );
});

describe('CarrierPublicController — himoya va xato konverti', () => {
  const REL = 'api/carrier/carrier-public.controller.ts';

  it('fayl mavjud (Group B)', () => {
    expect(exists(REL)).toBe(true);
  });

  const src = exists(REL) ? read(REL) : '';
  const decorators = classDecorators(src, 'CarrierPublicController');

  it("⭐ @Controller('carrier') + @UseGuards(CarrierIpThrottlerGuard, CarrierApiKeyGuard, CarrierThrottlerGuard) — AYNAN shu tartibda", () => {
    expect(decorators).toMatch(/@Controller\(\s*'carrier'\s*\)/);
    // IP limiti + kanonik yo'l — kalitdan OLDIN (kalitsiz oqim ham 429);
    // akkaunt limiti `request.carrier.id` ga tayanadi — kalit guard'idan KEYIN.
    expect(decorators).toMatch(
      /@UseGuards\(\s*CarrierIpThrottlerGuard\s*,\s*CarrierApiKeyGuard\s*,\s*CarrierThrottlerGuard\s*\)/,
    );
  });

  it('⭐ @UseFilters(CarrierExceptionFilter) — kontrakt konverti (code + trace_id)', () => {
    expect(decorators).toMatch(/@UseFilters\(\s*CarrierExceptionFilter\s*\)/);
  });

  it('JWT/RolesGuard ISHLATILMAYDI (faqat API kalit)', () => {
    expect(src).not.toMatch(/\bJwtGuard\b/);
    expect(src).not.toMatch(/\bRolesGuard\b/);
  });
});

describe('OrderService konstruktori — carrier uchun TEGILMAGAN (B10)', () => {
  /**
   * Carrier `OrderService` ni faqat CHAQIRADI. Konstruktorga yangi
   * bog'liqlik qo'shilsa `DashboardModule` dagi nusxa boot'da yiqiladi —
   * bu ro'yxat o'zgarsa, `order-service-di.spec.ts` dagi modullar ro'yxatini
   * ham yangilang.
   */
  const EXPECTED = [
    'OrderRepository',
    'OrderItemRepository',
    'ProductRepository',
    'CashRepository',
    'CashboxHistoryRepository',
    'UserRepository',
    'PostRepository',
    'TelegramRepository',
    'MyLogger',
    'DataSource',
    'OrderGateaway',
    'BotService',
    'OrderBotService',
    'ExternalIntegrationService',
    'IntegrationSyncService',
    'ActivityLogService',
    'MarketplaceSyncService',
    'ExtraCostApplierService',
    'ExtraCostRequestService',
    'CourierPenaltyService',
  ];

  it("konstruktor parametr turlari o'zgarmagan", () => {
    const src = read('api/order/order.service.ts');
    const classIdx = src.indexOf('export class OrderService');
    const ctorIdx = src.indexOf('constructor(', classIdx);
    const endIdx = src.indexOf(') {', ctorIdx);
    const ctor = src
      .slice(ctorIdx, endIdx)
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const types = [
      ...ctor.matchAll(/private\s+readonly\s+\w+\s*:\s*(\w+)/g),
    ].map((m) => m[1]);
    expect(types).toEqual(EXPECTED);
  });
});
