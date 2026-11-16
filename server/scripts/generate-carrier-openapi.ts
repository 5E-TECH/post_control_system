/**
 * CARRIER API — STATIK OPENAPI GENERATORI (`npm run docs:carrier-openapi`).
 *
 * Natija: `P/docs/carrier-openapi.json` — tashqi yetkazuvchiga yuboriladigan
 * mashina o'qiydigan spec (Postman / kod generatori). `CARRIER_API.md` va
 * `docs/integrations/15-carrier-api.md` shu faylga havola qiladi.
 *
 * ── BAZASIZ ─────────────────────────────────────────────────────────────
 *
 * To'liq ilova ko'tarilmaydi (Postgres, Telegram va h.k. kerak bo'lardi).
 * `CarrierOpenApiOfflineModule` faqat `CarrierPublicController` ni stub
 * bog'liqliklar bilan ko'taradi — hujjat controller va DTO metadata'sidan
 * quriladi, hech qanday servis metodi chaqirilmaydi, tarmoqqa ulanilmaydi.
 * Jonli `/api/v1/carrier-docs` ham AYNI `buildCarrierOpenApiDocument` dan.
 *
 * ── QACHON ISHGA TUSHIRILADI ────────────────────────────────────────────
 *
 * Carrier controller, DTO yoki `carrier-swagger.ts` o'zgarsa — keyin faylni
 * commit qiling. `carrier-openapi-drift.spec.ts` (bloklovchi CI qadami)
 * eskirgan faylni ushlaydi.
 *
 * Ishga tushirish (server/ papkasidan):
 *   npm run docs:carrier-openapi
 */
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import {
  CARRIER_OPENAPI_REPO_PATH,
  generateCarrierOpenApiDocument,
  serializeCarrierOpenApi,
} from '../src/api/carrier/carrier-openapi.offline';

async function main(): Promise<void> {
  const document = await generateCarrierOpenApiDocument();
  const outPath = resolve(__dirname, '..', CARRIER_OPENAPI_REPO_PATH);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, serializeCarrierOpenApi(document), 'utf8');

  const paths = Object.keys(document.paths ?? {});
  const operations = Object.values(document.paths ?? {}).reduce(
    (sum, item) => sum + Object.keys(item ?? {}).length,
    0,
  );
  const schemas = Object.keys(document.components?.schemas ?? {}).length;
  console.log(
    `Carrier OpenAPI yozildi → ${outPath}\n` +
      `  yo'llar: ${paths.length}  amallar: ${operations}  sxemalar: ${schemas}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Carrier OpenAPI yasab bo‘lmadi:', error);
    process.exit(1);
  });
