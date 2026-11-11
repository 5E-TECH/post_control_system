/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';
import {
  ExecutionContext,
  Controller,
  Get,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CarrierPublicController } from './carrier-public.controller';
import { CarrierService } from './carrier.service';
import { CarrierAccountService } from './carrier-account.service';
import { CarrierApiKeyGuard } from './guards/carrier-api-key.guard';
import { CarrierThrottlerGuard } from './guards/carrier-throttler.guard';
import { toCarrierOrderView } from './carrier-order-view';
import { toCarrierCashboxView } from './carrier-cashbox-view';
import {
  CARRIER_API_KEY_SCHEME,
  CARRIER_OPENAPI_LIVE_SERVER,
  CARRIER_OPENAPI_STATIC_SERVER,
  CARRIER_SWAGGER_GUIDE,
  CarrierDocsSettings,
  buildCarrierOpenApiDocument,
  carrierDocsBasicAuth,
  carrierOperationId,
  filterCarrierDocument,
  normalizeNullableRefs,
  setupCarrierSwagger,
} from './carrier-swagger';

/**
 * CARRIER API SWAGGER (`/api/v1/carrier-docs`) — Elchi
 * `carrier-swagger.spec.ts` porti.
 *
 * Qulflanadi:
 *   - hujjatda FAQAT `/carrier/*` (ichki va admin marshrutlar sizib chiqmaydi);
 *   - Elchi bilan kod generatori darajasidagi moslik: teg, operationId,
 *     xavfsizlik sxemasi, JSON/multipart tanalari, nullable obyektlar;
 *   - javob sxemasi = haqiqiy javob (`toCarrierOrderView` / `toCarrierCashboxView`);
 *   - ulanish qoidasi (ega qarori Q7): production'da bayroq + parol + Basic auth.
 */

/** Ichki marshrut — carrier hujjatiga TUSHMASLIGI kerak. */
@Controller('orders')
class InternalProbeController {
  @Get('secret')
  secret() {
    return { ok: true };
  }
}

const DEV: CarrierDocsSettings = {
  nodeEnv: 'development',
  enabled: false,
  user: 'carrier',
  password: '',
};

async function buildApp(
  settings: CarrierDocsSettings,
): Promise<{ app: INestApplication; result: string }> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1_000_000 }])],
    controllers: [CarrierPublicController, InternalProbeController],
    providers: [
      CarrierThrottlerGuard,
      { provide: CarrierService, useValue: {} },
      { provide: CarrierAccountService, useValue: {} },
    ],
  })
    .overrideGuard(CarrierApiKeyGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{ carrier?: unknown }>();
        req.carrier = {
          id: '0d1e2f3a-4b5c-4d6e-8f9a-0b1c2d3e4f5a',
          name: 'BTS',
          courier_user_id: '11111111-2222-4333-8444-555555555555',
        };
        return true;
      },
    })
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  // PCS bilan bir xil global prefiks — hujjat yo'llari baribir `/carrier/...`.
  app.setGlobalPrefix('api/v1');
  const result = setupCarrierSwagger(app, { settings });
  await app.init();
  return { app, result };
}

type SchemaObject = { properties?: Record<string, unknown> };

const schemaProps = (doc: OpenAPIObject, name: string): string[] =>
  Object.keys(
    (doc.components?.schemas?.[name] as SchemaObject | undefined)?.properties ??
      {},
  ).sort();

type DocsResponse = {
  status: number;
  text: string;
  headers: Record<string, string>;
  body: { paths?: Record<string, unknown>; info?: { title?: string } };
};

/** Tipli GET (supertest javobi `any` — lint qoidasi uchun bir joyda o'raladi). */
async function get(
  target: INestApplication,
  url: string,
  auth?: { user: string; password: string },
): Promise<DocsResponse> {
  const pending = request(target.getHttpServer() as App).get(url);
  const res = auth
    ? await pending.auth(auth.user, auth.password)
    : await pending;
  return {
    status: res.status,
    text: res.text,
    headers: res.headers as Record<string, string>,
    body: res.body as DocsResponse['body'],
  };
}

describe('Carrier API Swagger (/api/v1/carrier-docs)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('hujjat mazmuni', () => {
    let doc: OpenAPIObject;

    beforeAll(async () => {
      const built = await buildApp(DEV);
      doc = buildCarrierOpenApiDocument(built.app);
      await built.app.close();
    });

    it('faqat /carrier/* marshrutlari — global prefikssiz, ichki marshrut yo‘q', () => {
      expect(Object.keys(doc.paths).sort()).toEqual([
        '/carrier/cashbox',
        '/carrier/orders',
        '/carrier/orders/{id}/status',
        '/carrier/ping',
        '/carrier/returns',
        '/carrier/scan',
      ]);
      expect(JSON.stringify(doc)).not.toContain('/orders/secret');
    });

    it('jonli hujjat serveri nisbiy /api/v1 ("Try it out" ochilgan host’ga)', () => {
      expect(doc.servers).toEqual([{ url: CARRIER_OPENAPI_LIVE_SERVER }]);
    });

    it('X-Api-Key sxemasi — Authorize tugmasi; boshqa sxemalar yo‘q', () => {
      expect(doc.components?.securitySchemes).toEqual({
        [CARRIER_API_KEY_SCHEME]: {
          type: 'apiKey',
          name: 'X-Api-Key',
          in: 'header',
        },
      });
      expect(doc.security).toEqual([{ [CARRIER_API_KEY_SCHEME]: [] }]);
      for (const item of Object.values(doc.paths)) {
        for (const op of Object.values(item ?? {})) {
          expect((op as { security?: unknown }).security).toEqual([
            { [CARRIER_API_KEY_SCHEME]: [] },
          ]);
        }
      }
    });

    it('tavsif — BeePost qo‘llanmasi; teglar faqat Carrier (Elchi bilan bir xil)', () => {
      expect(doc.info.title).toBe('BeePost — Carrier API');
      expect(doc.info.description).toBe(CARRIER_SWAGGER_GUIDE);
      expect((doc.tags ?? []).map((t) => t.name)).toEqual(['Carrier']);
      // Qo'llanma BeePost profiliga mos: kalit prefiksi, baza manzili.
      expect(CARRIER_SWAGGER_GUIDE).toContain('bpc_');
      expect(CARRIER_SWAGGER_GUIDE).toContain(
        'https://<beepost-domain>/api/v1/carrier/ping',
      );
      expect(CARRIER_SWAGGER_GUIDE).not.toContain('elc_');
      expect(CARRIER_SWAGGER_GUIDE).not.toContain('waiting_customer');
    });

    it('⭐ operationId’lar Elchi bilan bir xil (kod generatori klienti farq qilmasin)', () => {
      const ids = Object.values(doc.paths)
        .flatMap((item) => Object.values(item ?? {}) as unknown[])
        .map((op) => (op as { operationId?: string }).operationId)
        .sort();
      expect(ids).toEqual([
        'CarrierGatewayController_cashbox',
        'CarrierGatewayController_listOrders',
        'CarrierGatewayController_ping',
        'CarrierGatewayController_returns',
        'CarrierGatewayController_scan',
        'CarrierGatewayController_updateStatus',
      ]);
      // Boshqa controllerlar — Nest sukuti.
      expect(carrierOperationId('CarrierAdminController', 'list')).toBe(
        'CarrierAdminController_list',
      );
    });

    it('javob sxemasi = haqiqiy javob (toCarrierOrderView / toCarrierCashboxView)', () => {
      expect(schemaProps(doc, 'CarrierOrderDto')).toEqual(
        Object.keys(toCarrierOrderView({ id: '1' })).sort(),
      );
      // Viloyat/tuman — nom emas, SOATO kodi.
      expect(schemaProps(doc, 'CarrierGeoRefDto')).toEqual([
        'id',
        'soato_code',
      ]);
      // Kassa: view kalitlari + tarix oynasi (from/to).
      expect(schemaProps(doc, 'CarrierCashboxDataDto')).toEqual(
        [
          ...Object.keys(toCarrierCashboxView({ balance: 0, history: [] })),
          'from',
          'to',
        ].sort(),
      );
      expect(schemaProps(doc, 'CarrierScanDataDto')).toEqual([
        'order',
        'received',
        'refreshed',
      ]);
      expect(schemaProps(doc, 'CarrierErrorResponseDto')).toContain('code');
      expect(schemaProps(doc, 'CarrierErrorResponseDto')).toContain('trace_id');
      expect(schemaProps(doc, 'CarrierReplacementDto')).toEqual([
        'of_order_id',
        'old_item_required',
      ]);
      expect(schemaProps(doc, 'CarrierCashboxEntryDto')).toEqual(
        Object.keys(
          toCarrierCashboxView({ balance: 0, history: [{ id: 'x' }] })
            .history[0],
        ).sort(),
      );
    });

    it('⭐ nullable obyekt maydonlarida `type: object` bor (OAS 3.0.3 — nullable kuchga kirsin)', () => {
      const order = doc.components?.schemas?.CarrierOrderDto as {
        properties: Record<string, Record<string, unknown>>;
      };
      for (const field of [
        'customer',
        'region',
        'district',
        'market',
        'replacement',
      ]) {
        expect(order.properties[field]).toEqual(
          expect.objectContaining({ nullable: true, type: 'object' }),
        );
      }
    });

    it('har bir $ref hujjat ichida mavjud (sinmagan havola yo‘q)', () => {
      const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"([^"]+)"/g)].map(
        (m) => m[1].split('/').pop() as string,
      );
      expect(refs.length).toBeGreaterThan(5);
      for (const name of refs) {
        expect(doc.components?.schemas).toHaveProperty(name);
      }
    });
  });

  describe('so‘rov tanasi va statik server', () => {
    let doc: OpenAPIObject;
    beforeAll(async () => {
      const built = await buildApp(DEV);
      doc = buildCarrierOpenApiDocument(built.app, {
        serverUrl: CARRIER_OPENAPI_STATIC_SERVER,
      });
      await built.app.close();
    });

    it('⭐ JSON tanasida `proof` (binary) YO‘Q, multipart’da bor', () => {
      const content = (
        doc.paths['/carrier/orders/{id}/status'].post as unknown as {
          requestBody: {
            content: Record<string, { schema: Record<string, unknown> }>;
          };
        }
      ).requestBody.content;
      expect(content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/CarrierOrderStatusRequestDto',
      });
      expect(JSON.stringify(content['multipart/form-data'].schema)).toContain(
        '"format":"binary"',
      );
    });

    it('statik spec’da baza manzili (CARRIER_API.md bilan bir xil); quantity — integer', () => {
      expect(doc.servers).toEqual([{ url: 'https://<beepost-domain>/api/v1' }]);
      const md = fs.readFileSync(
        path.resolve(__dirname, '../../../../CARRIER_API.md'),
        'utf8',
      );
      expect(md).toContain(CARRIER_OPENAPI_STATIC_SERVER);
      const item = doc.components?.schemas?.CarrierPartlySoldItemDto as {
        properties: Record<string, { type?: string }>;
      };
      expect(item.properties.quantity.type).toBe('integer');
    });
  });

  describe('filterCarrierDocument', () => {
    it('ishlatilmagan sxema, admin yo‘li va begona xavfsizlik sxemalari olib tashlanadi', () => {
      const out = filterCarrierDocument({
        openapi: '3.0.0',
        info: { title: 't', version: '1' },
        tags: [{ name: 'Carrier' }, { name: 'Carrier accounts' }],
        paths: {
          '/carrier/ping': {
            get: {
              responses: {
                200: {
                  description: 'ok',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/A' },
                    },
                  },
                },
              },
            },
          },
          '/carrier-accounts': { get: { responses: {} } },
          '/orders': { get: { responses: {} } },
        },
        components: {
          schemas: {
            A: { properties: { b: { $ref: '#/components/schemas/B' } } },
            B: { type: 'object' },
            Internal: { type: 'object' },
          },
          securitySchemes: {
            bearer: { type: 'http', scheme: 'bearer' },
            [CARRIER_API_KEY_SCHEME]: {
              type: 'apiKey',
              name: 'X-Api-Key',
              in: 'header',
            },
          },
        },
      });
      expect(Object.keys(out.paths)).toEqual(['/carrier/ping']);
      expect(Object.keys(out.components?.schemas ?? {}).sort()).toEqual([
        'A',
        'B',
      ]);
      expect(Object.keys(out.components?.securitySchemes ?? {})).toEqual([
        CARRIER_API_KEY_SCHEME,
      ]);
      expect(out.tags).toEqual([{ name: 'Carrier' }]);
    });
  });

  describe('normalizeNullableRefs', () => {
    it('faqat nullable + allOf + type’siz sxemaga type qo‘shadi, tartib Elchi’dagidek', () => {
      const out = normalizeNullableRefs({
        a: { nullable: true, description: 'd', allOf: [{ $ref: '#/x' }] },
        b: { nullable: true, type: 'string' },
        c: { allOf: [{ $ref: '#/x' }] },
        d: [{ nullable: true, allOf: [{ $ref: '#/y' }] }],
      });
      expect(Object.keys(out.a)).toEqual([
        'nullable',
        'description',
        'type',
        'allOf',
      ]);
      expect(out.a).toEqual({
        nullable: true,
        description: 'd',
        type: 'object',
        allOf: [{ $ref: '#/x' }],
      });
      expect(out.b).toEqual({ nullable: true, type: 'string' });
      expect(out.c).toEqual({ allOf: [{ $ref: '#/x' }] });
      expect(out.d[0]).toEqual(expect.objectContaining({ type: 'object' }));
    });
  });

  describe('ulanish qoidalari (Q7)', () => {
    it('dev: sukut bo‘yicha ochiq, JSON faqat carrier yo‘llari', async () => {
      const built = await buildApp(DEV);
      app = built.app;
      expect(built.result).toBe('mounted');
      const res = await get(app, '/api/v1/carrier-docs-json');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.paths ?? {})).toContain('/carrier/scan');
      expect(Object.keys(res.body.paths ?? {})).not.toContain('/orders/secret');
      expect((await get(app, '/api/v1/carrier-docs')).status).toBeLessThan(400);
      // YAML eshigi umuman yo'q.
      expect((await get(app, '/api/v1/carrier-docs-yaml')).status).toBe(404);
    });

    it('dev + parol — dev’da ham Basic auth', async () => {
      const built = await buildApp({ ...DEV, password: 'dev-pass' });
      app = built.app;
      expect((await get(app, '/api/v1/carrier-docs-json')).status).toBe(401);
      expect(
        (
          await get(app, '/api/v1/carrier-docs-json', {
            user: 'carrier',
            password: 'dev-pass',
          })
        ).status,
      ).toBe(200);
    });

    it('⭐ production: bayroq yo‘q — ulanmaydi (parol bo‘lsa ham)', async () => {
      const built = await buildApp({
        nodeEnv: 'production',
        enabled: false,
        user: 'carrier',
        password: 'secret-pass',
      });
      app = built.app;
      expect(built.result).toBe('disabled');
      expect((await get(app, '/api/v1/carrier-docs-json')).status).toBe(404);
    });

    it('⭐ production: yoqilgan, lekin parolsiz — ulanmaydi (yopiq)', async () => {
      const built = await buildApp({
        nodeEnv: 'production',
        enabled: true,
        user: 'carrier',
        password: '',
      });
      app = built.app;
      expect(built.result).toBe('disabled_no_password');
      expect((await get(app, '/api/v1/carrier-docs-json')).status).toBe(404);
    });

    it('⭐ production: yoqilgan + parol — Basic auth bilan ochiladi', async () => {
      const built = await buildApp({
        nodeEnv: 'production',
        enabled: true,
        user: 'bts',
        password: 'secret-pass',
      });
      app = built.app;
      expect(built.result).toBe('mounted');

      const anon = await get(app, '/api/v1/carrier-docs-json');
      expect(anon.status).toBe(401);
      expect(anon.headers['www-authenticate']).toMatch(/^Basic realm=/);
      expect(anon.text).not.toContain('/carrier/ping');
      expect((await get(app, '/api/v1/carrier-docs')).status).toBe(401);
      // UI statik fayllari ham parol ortida.
      expect(
        (await get(app, '/api/v1/carrier-docs/swagger-ui-init.js')).status,
      ).toBe(401);
      // Express marshrutlari katta-kichik harfni farqlamaydi — himoya ham.
      expect((await get(app, '/API/V1/CARRIER-DOCS-JSON')).status).toBe(401);
      expect((await get(app, '//api/v1//carrier-docs-json')).status).not.toBe(
        200,
      );
      // Noto'g'ri parol / login.
      expect(
        (
          await get(app, '/api/v1/carrier-docs-json', {
            user: 'bts',
            password: 'wrong',
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await get(app, '/api/v1/carrier-docs-json', {
            user: 'carrier',
            password: 'secret-pass',
          })
        ).status,
      ).toBe(401);

      const ok = await get(app, '/api/v1/carrier-docs-json', {
        user: 'bts',
        password: 'secret-pass',
      });
      expect(ok.status).toBe(200);
      expect(ok.body.info?.title).toBe('BeePost — Carrier API');
      // Basic auth faqat hujjatga — API'ning o'zi X-Api-Key bilan.
      expect((await get(app, '/api/v1/carrier/ping')).status).toBe(200);
    });
  });

  describe('carrierDocsBasicAuth', () => {
    const run = (url: string, authorization?: string) => {
      const headers: Record<string, string> = {};
      let code = 0;
      const res = {
        setHeader: (name: string, value: string) => {
          headers[name] = value;
        },
        status: (value: number) => {
          code = value;
          return { send: () => undefined };
        },
      };
      const next = jest.fn();
      carrierDocsBasicAuth('u', 'p')(
        { path: url, headers: authorization ? { authorization } : {} },
        res,
        next,
      );
      return { code: () => code, headers, next };
    };
    const basic = (value: string) =>
      `Basic ${Buffer.from(value).toString('base64')}`;

    it('hujjatdan tashqari yo‘llar tegilmaydi', () => {
      expect(run('/api/v1/carrier/ping').next).toHaveBeenCalled();
      expect(run('/api/v1/orders').next).toHaveBeenCalled();
    });

    it('to‘g‘ri login:parol — o‘tadi; qolgani 401 + WWW-Authenticate', () => {
      expect(run('/api/v1/carrier-docs', basic('u:p')).next).toHaveBeenCalled();
      for (const header of [
        undefined,
        basic('u:x'),
        basic('x:p'),
        basic('u:p:extra'),
        'Bearer abc',
        'Basic !!!',
      ]) {
        const result = run('/api/v1/carrier-docs-json', header);
        expect(result.next).not.toHaveBeenCalled();
        expect(result.code()).toBe(401);
        expect(result.headers['WWW-Authenticate']).toMatch(/^Basic realm=/);
      }
    });
  });

  it('app.service.ts carrier Swagger’ni CarrierModule bilan ulaydi', () => {
    const bootstrap = fs.readFileSync(
      path.join(__dirname, '../app.service.ts'),
      'utf8',
    );
    expect(bootstrap).toContain('setupCarrierSwagger(app, {');
    expect(bootstrap).toMatch(/include:\s*\[CarrierModule\]/);
    // Asosiy Swagger'dan keyin, listen'dan oldin.
    expect(bootstrap.indexOf('setupCarrierSwagger(app')).toBeGreaterThan(
      bootstrap.indexOf('SwaggerModule.setup(api'),
    );
    expect(bootstrap.indexOf('setupCarrierSwagger(app')).toBeLessThan(
      bootstrap.indexOf('await app.listen'),
    );
  });
});
