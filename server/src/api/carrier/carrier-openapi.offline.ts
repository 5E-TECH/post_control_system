import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { ThrottlerModule } from '@nestjs/throttler';
import { CarrierAccountService } from './carrier-account.service';
import { CarrierPublicController } from './carrier-public.controller';
import { CarrierService } from './carrier.service';
import { CarrierApiKeyGuard } from './guards/carrier-api-key.guard';
import { CarrierIpThrottlerGuard } from './guards/carrier-ip-throttler.guard';
import { CarrierThrottlerGuard } from './guards/carrier-throttler.guard';
import {
  CARRIER_OPENAPI_STATIC_SERVER,
  buildCarrierOpenApiDocument,
} from './carrier-swagger';

/**
 * STATIK CARRIER OPENAPI — BAZASIZ (`npm run docs:carrier-openapi` va
 * `carrier-openapi-drift.spec.ts`).
 *
 * NEGA ALOHIDA MODUL. To'liq `AppModule` (yoki `CarrierModule` →
 * `OrderModule` → …) ko'tarilishi uchun Postgres, Telegram tokenlari va
 * boshqa env kerak — CI va dasturchi mashinasida spec yasash uchun bu
 * ortiqcha. Hujjat faqat controller + DTO metadata'sidan quriladi, shuning
 * uchun bu yerda faqat `CarrierPublicController` va uning bog'liqliklari
 * BO'SH stub sifatida turadi: servis metodlari hech qachon chaqirilmaydi.
 *
 * Guard'lar haqiqiy klasslar: Nest `@UseGuards` dagi klasslarni ham DI
 * grafiga qo'shadi — bog'liqligi (kalit servisi, throttler sozlamasi)
 * yetmasa ilova ko'tarilmaydi. `@UseFilters` filtri bog'liqliksiz.
 *
 * Jonli `/api/v1/carrier-docs` ham AYNI `buildCarrierOpenApiDocument` dan
 * chiqadi (`include: [CarrierModule]`) — ikkalasi bir xil controller'ni
 * o'qigani uchun ajralmaydi; buni `carrier-di.spec.ts` ham tekshiradi.
 */
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1 }])],
  controllers: [CarrierPublicController],
  providers: [
    { provide: CarrierService, useValue: {} },
    { provide: CarrierAccountService, useValue: {} },
    CarrierIpThrottlerGuard,
    CarrierApiKeyGuard,
    CarrierThrottlerGuard,
  ],
})
export class CarrierOpenApiOfflineModule {}

/** Statik spec — `https://<beepost-domain>/api/v1` server bilan. */
export async function generateCarrierOpenApiDocument(): Promise<OpenAPIObject> {
  const app = await NestFactory.create(CarrierOpenApiOfflineModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    return buildCarrierOpenApiDocument(app, {
      serverUrl: CARRIER_OPENAPI_STATIC_SERVER,
      include: [CarrierOpenApiOfflineModule],
    });
  } finally {
    await app.close();
  }
}

/** Fayl ko'rinishi — generator va drift testi AYNI formatni ishlatadi. */
export function serializeCarrierOpenApi(document: OpenAPIObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** Repodagi statik spec yo'li (`P/docs/carrier-openapi.json`), `server/` ga nisbatan. */
export const CARRIER_OPENAPI_REPO_PATH = '../docs/carrier-openapi.json';
