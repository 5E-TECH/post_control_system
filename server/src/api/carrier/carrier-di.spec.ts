/// <reference types="jest" />
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import {
  Global,
  HttpException,
  HttpStatus,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { ActivityLogService } from 'src/api/activity-log/activity-log.service';
import { OrderModule } from 'src/api/order/order.module';
import { OrderService } from 'src/api/order/order.service';
import { PostModule } from 'src/api/post/post.module';
import { PostService } from 'src/api/post/post.service';
import { Roles, Status } from 'src/common/enums';
import { CarrierAccountEntity } from 'src/core/entity/carrier-account.entity';
import { CarrierModule } from './carrier.module';
import { CarrierAdminController } from './carrier-admin.controller';
import { CarrierPublicController } from './carrier-public.controller';
import { CarrierAccountService, hashApiKey } from './carrier-account.service';
import { CarrierIdempotencyService } from './carrier-idempotency.service';
import { CarrierService } from './carrier.service';
import { CarrierApiKeyGuard } from './guards/carrier-api-key.guard';
import { CarrierThrottlerGuard } from './guards/carrier-throttler.guard';
import { CarrierIpThrottlerGuard } from './guards/carrier-ip-throttler.guard';
import {
  CARRIER_OPENAPI_STATIC_SERVER,
  buildCarrierOpenApiDocument,
} from './carrier-swagger';
import { generateCarrierOpenApiDocument } from './carrier-openapi.offline';

/**
 * CARRIER API — HAQIQIY DI GRAFI (boot'siz ishga tushish qulfi).
 *
 * NEGA. `carrier-wiring.spec.ts` modulni MATN sifatida tekshiradi, unit
 * testlar esa servislarni `new` bilan yasaydi — ikkalasi ham Nest DI
 * xatosini KO'RMAYDI ("Nest can't resolve dependencies of the
 * CarrierService (?, …)"). Bunday xato faqat server ko'tarilganda chiqadi,
 * ya'ni deploy paytida. Bu yerda HAQIQIY `CarrierModule` metadata'si
 * (importlar, `forFeature` ro'yxati, providerlar, controllerlar va
 * `@UseGuards`/`@UseFilters` dagi klasslar) Nest tomonidan quriladi;
 * faqat chegaradagi narsalar soxta:
 *   - baza (`DataSource` — `forFeature` repozitoriylari undan olinadi);
 *   - `OrderModule` / `PostModule` (o'z 20+ bog'liqligi bilan) — o'rniga
 *     faqat eksport qilinadigan servis;
 *   - global `ActivityLogModule`.
 * `JwtModule` (global) va `ThrottlerModule` — PCS `AppModule` dagidek.
 *
 * Qo'shimcha: HTTP orqali guard → filtr → controller zanjiri, jonli
 * Swagger hujjati statik spec bilan bir xilligi va fayl darajasidagi aylanma
 * importlar yo'qligi.
 */

type RepoMock = Record<string, jest.Mock>;
const repos = new Map<unknown, RepoMock>();
const repoFor = (entity: unknown): RepoMock => {
  let repo = repos.get(entity);
  if (!repo) {
    repo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repos.set(entity, repo);
  }
  return repo;
};

const fakeDataSource = {
  options: { type: 'postgres' },
  entityMetadatas: [],
  getRepository: jest.fn((entity: unknown) => repoFor(entity)),
  transaction: jest.fn(),
  query: jest.fn(),
};
const activityLog = { log: jest.fn().mockResolvedValue(undefined) };
const orderService = { sellOrder: jest.fn() };
const postService = { receiveOrderForCourierById: jest.fn() };

@Global()
@Module({
  providers: [
    { provide: DataSource, useValue: fakeDataSource },
    { provide: ActivityLogService, useValue: activityLog },
  ],
  exports: [DataSource, ActivityLogService],
})
class FakeInfraModule {}

@Module({
  providers: [{ provide: OrderService, useValue: orderService }],
  exports: [OrderService],
})
class FakeOrderModule {}

@Module({
  providers: [{ provide: PostService, useValue: postService }],
  exports: [PostService],
})
class FakePostModule {}

const API_KEY = `bpc_${'a'.repeat(64)}`;
const ACCOUNT = {
  id: '0d1e2f3a-4b5c-4d6e-8f9a-0b1c2d3e4f5a',
  name: 'BTS',
  is_active: true,
  ip_allowlist: [] as string[],
  courier_user_id: '11111111-2222-4333-8444-555555555555',
  courier: {
    id: '11111111-2222-4333-8444-555555555555',
    role: Roles.COURIER,
    status: Status.ACTIVE,
    is_deleted: false,
    external_provider: 'carrier',
  },
};

/** `validateKey` dagi QueryBuilder zanjiri — natija `getOne` da. */
function keyLookup(result: () => Promise<unknown>) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['leftJoin', 'addSelect', 'where', 'andWhere']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getOne = jest.fn(result);
  return qb;
}

/** PCS `app.service.ts` dagi global ValidationPipe bilan bir xil sozlama. */
const pcsValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    transform: true,
    exceptionFactory: (errors) =>
      new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: errors.map((e) =>
            Object.values(e.constraints ?? {}).join(', '),
          ),
          error: "Ma'lumotlar validatsiyadan o'tmadi",
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
  });

describe('CarrierModule — haqiqiy DI grafi', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        FakeInfraModule,
        JwtModule.register({ global: true }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
        CarrierModule,
      ],
    })
      .overrideModule(OrderModule)
      .useModule(FakeOrderModule)
      .overrideModule(PostModule)
      .useModule(FakePostModule)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(pcsValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    repoFor(CarrierAccountEntity).createQueryBuilder.mockImplementation(() =>
      keyLookup(() => Promise.resolve(ACCOUNT)),
    );
  });

  it('controllerlar, servislar va guardlar Nest tomonidan quriladi', () => {
    for (const token of [
      CarrierAdminController,
      CarrierPublicController,
      CarrierService,
      CarrierAccountService,
      CarrierIdempotencyService,
      CarrierIpThrottlerGuard,
      CarrierApiKeyGuard,
      CarrierThrottlerGuard,
    ]) {
      expect(moduleRef.get(token, { strict: false })).toBeDefined();
    }
  });

  it('CarrierService OrderService/PostService ni EKSPORT orqali oladi (qayta e’lon qilinmagan)', () => {
    const service: unknown = moduleRef.get(CarrierService, { strict: false });
    const deps = service as {
      orderService: unknown;
      postService: unknown;
      activityLog: unknown;
    };
    expect(deps.orderService).toBe(orderService);
    expect(deps.postService).toBe(postService);
    expect(deps.activityLog).toBe(activityLog);
  });

  it('forFeature repozitoriylari DataSource dan olinadi (8 entity; @InjectRepository yetishmasa compile yiqilardi)', () => {
    const requested = (fakeDataSource.getRepository.mock.calls as unknown[][])
      .map(([entity]) => (entity as { name?: string })?.name)
      .sort();
    expect(requested).toEqual(
      [
        'CarrierAccountEntity',
        'CarrierIdempotencyKeyEntity',
        'CashEntity',
        'CashboxHistoryEntity',
        'OrderEntity',
        'OrderItemEntity',
        'PostEntity',
        'UserEntity',
      ].sort(),
    );
  });

  describe('HTTP zanjiri: guard → filtr → controller', () => {
    /** Tipli javob (supertest `body` — `any`). */
    type ApiResponse = {
      status: number;
      headers: Record<string, string>;
      body: {
        statusCode?: number;
        message?: unknown;
        code?: string;
        trace_id?: string;
        data?: unknown;
      };
    };
    const call = async (
      method: 'get' | 'post',
      url: string,
      headers: Record<string, string> = {},
      body?: object,
    ): Promise<ApiResponse> => {
      let pending = request(app.getHttpServer() as App)[method](url);
      for (const [name, value] of Object.entries(headers)) {
        pending = pending.set(name, value);
      }
      const res = body ? await pending.send(body) : await pending;
      return {
        status: res.status,
        headers: res.headers as Record<string, string>,
        body: res.body as ApiResponse['body'],
      };
    };
    const KEY = { 'X-Api-Key': API_KEY };

    it('kalitsiz → 401, kontrakt konverti (trace_id + X-Trace-Id)', async () => {
      const res = await call('get', '/api/v1/carrier/ping');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        statusCode: 401,
        message: "X-Api-Key yo'q yoki yaroqsiz",
        trace_id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
      });
      expect(res.headers['x-trace-id']).toBe(res.body.trace_id);
    });

    it('to‘g‘ri kalit → 200 ping (hash bo‘yicha qidiriladi)', async () => {
      const res = await call('get', '/api/v1/carrier/ping', KEY);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        statusCode: 200,
        message: 'ok',
        data: {
          authenticated: true,
          carrier: { id: ACCOUNT.id, name: ACCOUNT.name },
        },
      });
      const qb = repoFor(CarrierAccountEntity).createQueryBuilder.mock
        .results[0].value as Record<string, jest.Mock>;
      expect(qb.where).toHaveBeenCalledWith('account.api_key_hash = :hash', {
        hash: hashApiKey(API_KEY),
      });
    });

    it('kalitni tekshirib bo‘lmadi (baza) → 503 CARRIER_KEY_CHECK_UNAVAILABLE', async () => {
      repoFor(CarrierAccountEntity).createQueryBuilder.mockImplementation(() =>
        keyLookup(() => Promise.reject(new Error('connection terminated'))),
      );
      const res = await call('get', '/api/v1/carrier/ping', KEY);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('CARRIER_KEY_CHECK_UNAVAILABLE');
    });

    it('id UUID emas → 400 (servisga yetmaydi)', async () => {
      const res = await call(
        'post',
        '/api/v1/carrier/orders/900/status',
        { ...KEY, 'Idempotency-Key': 'k-1' },
        { status: 'sold' },
      );
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Buyurtma id noto'g'ri");
      expect(orderService.sellOrder).not.toHaveBeenCalled();
    });

    it('⭐ begona maydon (extraCost) → global 422 emas, kontrakt 400', async () => {
      const res = await call(
        'post',
        '/api/v1/carrier/orders/3f6c1a2e-8b4d-4c7a-9e21-5d0b7f3a9c10/status',
        { ...KEY, 'Idempotency-Key': 'k-2' },
        { status: 'sold', extraCost: 5000 },
      );
      expect(res.status).toBe(400);
      expect(String(res.body.message)).toContain('extraCost');
      expect(res.body.trace_id).toEqual(expect.any(String));
      expect(orderService.sellOrder).not.toHaveBeenCalled();
    });

    it('admin marshruti carrier filtri ostida EMAS va JWT siz ochilmaydi', async () => {
      const res = await call('get', '/api/v1/carrier-accounts');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.body.trace_id).toBeUndefined();
    });
  });

  it('⭐ jonli hujjat (include: CarrierModule) = statik spec generatori', async () => {
    const live = buildCarrierOpenApiDocument(app, {
      include: [CarrierModule],
      serverUrl: CARRIER_OPENAPI_STATIC_SERVER,
    });
    expect(live).toEqual(await generateCarrierOpenApiDocument());
    expect(Object.keys(live.paths)).not.toContain('/carrier-accounts');
  });
});

describe('Modul importlari va aylanma bog‘liqlik', () => {
  it('CarrierModule OrderModule/PostModule ni forwardRef bilan import qiladi', () => {
    const imports = (Reflect.getMetadata('imports', CarrierModule) ??
      []) as Array<{ forwardRef?: () => unknown }>;
    const forwarded = imports
      .filter((item) => typeof item?.forwardRef === 'function')
      .map((item) => item.forwardRef!());
    expect(forwarded).toEqual(
      expect.arrayContaining([OrderModule, PostModule]),
    );
  });

  it('OrderModule OrderService ni, PostModule PostService ni eksport qiladi', () => {
    expect(Reflect.getMetadata('exports', OrderModule)).toContain(OrderService);
    expect(Reflect.getMetadata('exports', PostModule)).toContain(PostService);
  });

  /**
   * Fayl darajasidagi aylanma import Nest'da `undefined` modul/klass bo'lib
   * chiqadi ("A circular dependency between modules") — va faqat boot'da.
   * `post.service.ts` `carrier-account.service.ts` dan konstanta oladi,
   * `carrier.service.ts` esa `post.service.ts` ni — shu zanjir yopilib
   * qolmasligi kerak.
   */
  it('carrier fayllari hech qanday import siklida qatnashmaydi', () => {
    const SRC = path.resolve(__dirname, '../..');
    const graph = importGraph(SRC, [
      path.join(SRC, 'api/carrier/carrier.module.ts'),
      path.join(SRC, 'api/carrier/carrier-swagger.ts'),
      path.join(SRC, 'api/carrier/carrier-openapi.offline.ts'),
    ]);
    const carrierCycles = stronglyConnected(graph).filter((component) =>
      component.some((file) => file.includes(`${path.sep}carrier${path.sep}`)),
    );
    expect(
      carrierCycles.map((c) => c.map((f) => path.relative(SRC, f))),
    ).toEqual([]);
  });

  it('CarrierModule ni faqat AppModule (va bootstrap) import qiladi', () => {
    const SRC = path.resolve(__dirname, '../..');
    const importers = listTs(SRC)
      .filter((file) => !file.endsWith('.spec.ts'))
      .filter((file) =>
        /from\s+['"][^'"]*carrier\/carrier\.module['"]/.test(
          fs.readFileSync(file, 'utf8'),
        ),
      )
      .map((file) => path.relative(SRC, file))
      .sort();
    expect(importers).toEqual(['api/app.module.ts', 'api/app.service.ts']);
  });
});

// ───────────────────────── import grafi yordamchilari ─────────────────────────

function listTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTs(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

/** Runtime importlar (`import type` tashlanadi — kompilyatsiyada yo'qoladi). */
function importGraph(src: string, roots: string[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const resolveSpec = (from: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('src/')) base = path.join(src, spec.slice(4));
    else if (spec.startsWith('.'))
      base = path.resolve(path.dirname(from), spec);
    else return null;
    for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  };
  const visit = (file: string): void => {
    if (graph.has(file)) return;
    const source = fs.readFileSync(file, 'utf8');
    const deps: string[] = [];
    const re =
      /^\s*(?:import|export)\s+(?!type\s)[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
      const resolved = resolveSpec(file, match[1]);
      if (resolved) deps.push(resolved);
    }
    graph.set(file, deps);
    deps.forEach(visit);
  };
  roots.forEach(visit);
  return graph;
}

/** Tarjan — 1 dan katta kuchli bog'langan komponentlar (= import sikllari). */
function stronglyConnected(graph: Map<string, string[]>): string[][] {
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const result: string[][] = [];
  const strong = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) result.push(component);
    }
  };
  for (const v of graph.keys()) if (!index.has(v)) strong(v);
  return result;
}
