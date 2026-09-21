/// <reference types="jest" />
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { ExtraCostController } from 'src/api/extra-cost/extra-cost.controller';
import { ExtraCostProofService } from 'src/api/extra-cost/extra-cost-proof.service';
import { ExtraCostDecisionService } from 'src/api/extra-cost/extra-cost-decision.service';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/enums';
import {
  PROOF_MAX_FILES,
  PROOF_MAX_VIDEO_BYTES,
  PROOF_TMP_DIR,
} from 'src/api/extra-cost/proof-storage.const';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ISBOT YUKLASH ENDPOINTI — HAQIQIY HTTP orqali.
 *
 * Unit testlar servis mantig'ini qamraydi, lekin ENDPOINT darajasidagi uchta
 * himoya faqat shu yerda ko'rinadi, chunki ular servisga umuman yetib
 * bormaydi:
 *
 *   ROL DARVOZASI     — `RolesGuard` (market/registrator yuklay olmasin)
 *   FAYL SONI         — `FilesInterceptor(files, 3)` multer darajasida
 *   FAYL HAJMI        — `limits.fileSize` multer darajasida
 *
 * Agar dekoratorlardan biri tasodifan o'chirilsa (loyihada `@UseGuards` ni
 * izohga olish xatosi allaqachon bo'lgan — `order.controller.ts:356`), unit
 * testlar buni SEZMAYDI.
 */

/** Soxta auth: JwtGuard o'rniga req.user ni qo'yadi. */
let CURRENT: any = { id: 'courier-1', role: Roles.COURIER };
class FakeJwt {
  canActivate(ctx: any) {
    ctx.switchToHttp().getRequest().user = CURRENT;
    return true;
  }
}

let app: INestApplication;

beforeAll(async () => {
  const mod = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }])],
    controllers: [ExtraCostController],
    // Servis TO'LIQ soxta: bu yerda uning mantig'i emas, endpoint
    // darvozalari sinaladi (mantiq uchun `extra-cost-proof.service.spec.ts`).
    providers: [ExtraCostProofService, ExtraCostDecisionService],
  })
    .overrideProvider(ExtraCostProofService)
    .useValue({
      saveUploaded: jest.fn((files: any[]) =>
        Promise.resolve(
          files.map((f, i) => ({
            proof_id: 'p' + i,
            size_bytes: f.size,
            dup_count: 0,
          })),
        ),
      ),
      openForViewer: jest.fn(),
    })
    .overrideProvider(ExtraCostDecisionService)
    .useValue({
      listForMarket: jest.fn(() => Promise.resolve({ items: [], total: 0 })),
      listForCourier: jest.fn(() =>
        Promise.resolve({ items: [], total: 0, pending_total: 0 }),
      ),
      listForAdmin: jest.fn(() => Promise.resolve({ items: [], total: 0 })),
      countOpenForMarket: jest.fn(() => Promise.resolve(0)),
      countUnseenForCourier: jest.fn(() => Promise.resolve(0)),
      markSeenByCourier: jest.fn(() => Promise.resolve(0)),
      approve: jest.fn(() => Promise.resolve({ id: 'r1' })),
      reject: jest.fn(() => Promise.resolve({ id: 'r1' })),
      bulkApprove: jest.fn(() => Promise.resolve({ approved: 1, skipped: [] })),
      attachProof: jest.fn(() => Promise.resolve({ id: 'r1' })),
    })
    .overrideGuard(JwtGuard)
    .useClass(FakeJwt)
    .compile();

  app = mod.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  await app.init();
});

afterAll(async () => {
  await app?.close();
  // Multer endi `diskStorage` ishlatadi — test yuklamalari vaqtinchalik
  // papkada qolib ketmasin (E4 testi 80 MB lik fayl yuboradi).
  try {
    for (const name of fs.readdirSync(PROOF_TMP_DIR)) {
      fs.rmSync(path.join(PROOF_TMP_DIR, name), { force: true });
    }
  } catch {
    /* papka yo'q bo'lsa tozalaydigan narsa ham yo'q */
  }
});

describe('E2E: isbot yuklash endpointi', () => {
  const JPEG = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(40, 1),
  ]);

  it('E1: KURYER rasm yuklay oladi', async () => {
    CURRENT = { id: 'courier-1', role: Roles.COURIER };
    const res = await request(app.getHttpServer())
      .post('/extra-cost/proof')
      .attach('files', JPEG, 'chek.jpg');
    expect(res.status).toBe(201);
    expect(res.body.data[0]).toHaveProperty('proof_id');
    expect(JSON.stringify(res.body)).not.toContain('.jpg');
  });

  it('E2: MARKET yuklay OLMAYDI (rol darvozasi)', async () => {
    CURRENT = { id: 'market-1', role: Roles.MARKET };
    const res = await request(app.getHttpServer())
      .post('/extra-cost/proof')
      .attach('files', JPEG, 'chek.jpg');
    expect(res.status).toBe(403);
  });

  it("E3: chegaradan ko'p fayl multer darajasida to'siladi", async () => {
    CURRENT = { id: 'courier-1', role: Roles.COURIER };
    const req = request(app.getHttpServer()).post('/extra-cost/proof');
    for (let i = 0; i < PROOF_MAX_FILES + 2; i++) {
      req.attach('files', JPEG, `c${i}.jpg`);
    }
    const res = await req;
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("E3b: chegara ichidagi fayl soni O'TADI", async () => {
    CURRENT = { id: 'courier-1', role: Roles.COURIER };
    const req = request(app.getHttpServer()).post('/extra-cost/proof');
    for (let i = 0; i < PROOF_MAX_FILES; i++) {
      req.attach('files', JPEG, `c${i}.jpg`);
    }
    const res = await req;
    expect(res.status).toBe(201);
  });

  it('E4: multer bitta fayl chegarasidan katta fayl RAD ETILADI', async () => {
    // Multer darajasidagi chegara eng KATTA ruxsat etilgan fayl (video)
    // bo'yicha; turga xos aniq chegara (rasm 8 MB) servisda qo'llanadi.
    CURRENT = { id: 'courier-1', role: Roles.COURIER };
    const big = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(PROOF_MAX_VIDEO_BYTES + 1024, 1),
    ]);
    const res = await request(app.getHttpServer())
      .post('/extra-cost/proof')
      .attach('files', big, 'big.jpg');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('E2E: qaror endpointlari — rol darvozalari', () => {
  const UUID = '11111111-2222-4333-8444-555555555555';

  it('E5: KURYER market ro‘yxatini KO‘RA OLMAYDI', async () => {
    CURRENT = { id: 'courier-1', role: Roles.COURIER };
    const res = await request(app.getHttpServer()).get('/extra-cost/market/me');
    expect(res.status).toBe(403);
  });

  it('E6: MARKET kuryer ro‘yxatini KO‘RA OLMAYDI', async () => {
    CURRENT = { id: 'market-1', role: Roles.MARKET };
    const res = await request(app.getHttpServer()).get(
      '/extra-cost/courier/me',
    );
    expect(res.status).toBe(403);
  });

  it('E7: KURYER o‘zi TASDIQLAY OLMAYDI (eng muhim darvoza)', async () => {
    // Kuryer o'z xarajatini tasdiqlay olsa, butun nazorat ma'nosiz bo'lardi.
    CURRENT = { id: 'courier-1', role: Roles.COURIER };
    const res = await request(app.getHttpServer()).post(
      `/extra-cost/${UUID}/approve`,
    );
    expect(res.status).toBe(403);
  });

  it('E8: MARKET admin arbitraj navbatini KO‘RA OLMAYDI', async () => {
    CURRENT = { id: 'market-1', role: Roles.MARKET };
    const res = await request(app.getHttpServer()).get('/extra-cost/admin');
    expect(res.status).toBe(403);
  });

  it('E9: MARKET tasdiqlay oladi', async () => {
    CURRENT = { id: 'market-1', role: Roles.MARKET };
    const res = await request(app.getHttpServer()).post(
      `/extra-cost/${UUID}/approve`,
    );
    expect(res.status).toBe(201);
  });

  it('E10: rad etishda SABAB majburiy — bo‘sh bo‘lsa 422', async () => {
    CURRENT = { id: 'market-1', role: Roles.MARKET };
    const res = await request(app.getHttpServer())
      .post(`/extra-cost/${UUID}/reject`)
      .send({ review_note: '  ' });
    expect(res.status).toBe(422);
  });

  it('E11: rad etishda sabab bo‘lsa o‘tadi', async () => {
    CURRENT = { id: 'market-1', role: Roles.MARKET };
    const res = await request(app.getHttpServer())
      .post(`/extra-cost/${UUID}/reject`)
      .send({ review_note: "Chek rasmida summa ko'rinmayapti" });
    expect(res.status).toBe(201);
  });

  it('E12: bulk-approve 50 tadan ko‘p ID ni RAD ETADI', async () => {
    CURRENT = { id: 'market-1', role: Roles.MARKET };
    const ids = Array.from({ length: 51 }, () => UUID);
    const res = await request(app.getHttpServer())
      .post('/extra-cost/bulk-approve')
      .send({ ids });
    expect(res.status).toBe(422);
  });

  it('E13: noto‘g‘ri UUID — 400', async () => {
    CURRENT = { id: 'market-1', role: Roles.MARKET };
    const res = await request(app.getHttpServer()).post(
      '/extra-cost/emas-uuid/approve',
    );
    expect(res.status).toBe(400);
  });
});

describe('E2E: isbot biriktirish (awaiting_proof dan chiqish)', () => {
  const UUID = '11111111-2222-4333-8444-555555555555';

  it('E14: KURYER isbot biriktira oladi', async () => {
    CURRENT = { id: 'courier-1', role: Roles.COURIER };
    const res = await request(app.getHttpServer())
      .post(`/extra-cost/${UUID}/attach-proof`)
      .send({ proof_ids: [UUID] });
    expect(res.status).toBe(201);
  });

  it('E15: MARKET isbot biriktira OLMAYDI', async () => {
    CURRENT = { id: 'market-1', role: Roles.MARKET };
    const res = await request(app.getHttpServer())
      .post(`/extra-cost/${UUID}/attach-proof`)
      .send({ proof_ids: [UUID] });
    expect(res.status).toBe(403);
  });

  it("E16: bo'sh ro'yxat RAD ETILADI", async () => {
    CURRENT = { id: 'courier-1', role: Roles.COURIER };
    const res = await request(app.getHttpServer())
      .post(`/extra-cost/${UUID}/attach-proof`)
      .send({ proof_ids: [] });
    expect(res.status).toBe(422);
  });
});
