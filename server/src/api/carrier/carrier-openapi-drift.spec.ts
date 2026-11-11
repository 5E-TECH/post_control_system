/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';
import type { OpenAPIObject } from '@nestjs/swagger';
import {
  CARRIER_OPENAPI_REPO_PATH,
  generateCarrierOpenApiDocument,
  serializeCarrierOpenApi,
} from './carrier-openapi.offline';

/**
 * STATIK SPEC DRIFT DARVOZASI — `P/docs/carrier-openapi.json`.
 *
 * NEGA. Bu fayl tashqi yetkazuvchiga yuboriladi: u Postman'ga yoki kod
 * generatoriga import qiladi va o'z integratsiyasini SHU fayl bo'yicha
 * yozadi. Controller yoki DTO o'zgarib, fayl yangilanmasa, kompaniya
 * eskirgan kontrakt bilan ishlab ketadi — va buni hech kim sezmaydi
 * (barcha unit testlar yashil). Elchi'da bu `git diff --exit-code` CI
 * qadami; bu yerda bloklovchi "Carrier API testlari" qadamining bir qismi.
 *
 * Tuzatish: `cd server && npm run docs:carrier-openapi` va faylni commit qiling.
 */
const REPO_FILE = path.resolve(
  __dirname,
  '../../..',
  CARRIER_OPENAPI_REPO_PATH,
);
const HINT =
  'docs/carrier-openapi.json eskirgan — `cd server && npm run docs:carrier-openapi` ishga tushirib, faylni commit qiling';

describe('docs/carrier-openapi.json — koddan ajralmagan', () => {
  let generated: OpenAPIObject;
  let committedText: string;
  let committed: OpenAPIObject;

  beforeAll(async () => {
    generated = await generateCarrierOpenApiDocument();
    committedText = fs.readFileSync(REPO_FILE, 'utf8');
    committed = JSON.parse(committedText) as OpenAPIObject;
  });

  it('yo‘llar va amallar bir xil', () => {
    const ops = (doc: OpenAPIObject) =>
      Object.entries(doc.paths)
        .flatMap(([p, item]) =>
          Object.entries(item ?? {}).map(
            ([method, op]) =>
              `${method.toUpperCase()} ${p} ${(op as { operationId?: string }).operationId}`,
          ),
        )
        .sort();
    expect({ hint: HINT, ops: ops(committed) }).toEqual({
      hint: HINT,
      ops: ops(generated),
    });
  });

  it('sxemalar (nomlar va maydonlar) bir xil', () => {
    expect({ hint: HINT, schemas: committed.components?.schemas }).toEqual({
      hint: HINT,
      schemas: generated.components?.schemas,
    });
  });

  it('⭐ fayl AYNAN generator natijasi (tavsiflar, misollar, server ham)', () => {
    // Avvalgi ikki test qaysi qism farq qilishini ko'rsatadi; bu esa
    // hammasini (bayt darajasida) qulflaydi.
    const fresh = serializeCarrierOpenApi(generated);
    if (committedText !== fresh) {
      throw new Error(HINT);
    }
  });

  it('statik server — CARRIER_API.md dagi baza manzili', () => {
    expect(committed.servers).toEqual([
      { url: 'https://<beepost-domain>/api/v1' },
    ]);
  });
});
