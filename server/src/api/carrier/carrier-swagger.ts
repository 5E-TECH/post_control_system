import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
  type SwaggerDocumentOptions,
} from '@nestjs/swagger';
import { createHash, timingSafeEqual } from 'crypto';
import config from 'src/config';

/**
 * CARRIER API UCHUN ALOHIDA SWAGGER — tashqi yetkazuvchi dasturchisi FAQAT
 * `/carrier/*` endpointlarini ko'radi (Elchi `apps/api-gateway/src/carrier-swagger.ts`
 * porti).
 *
 * NEGA ALOHIDA. Asosiy Swagger (`/api/v1`) BeePost'ning BARCHA ichki
 * marshrutlarini ko'rsatadi va production'da o'chiq. Tashqi kompaniyaga esa
 * ichki API xaritasi kerak emas — faqat o'z kontrakti.
 *
 * Ulanish qoidasi (ega qarori Q7):
 *   - production'dan tashqarida — doim ochiq (parol berilgan bo'lsa Basic auth);
 *   - production'da — FAQAT `CARRIER_DOCS_ENABLED` yoqilgan VA
 *     `CARRIER_DOCS_PASSWORD` berilgan bo'lsa, HTTP Basic auth ortida.
 *     Parolsiz yoqilgan bayroq hujjatni OCHMAYDI: ochiq hujjat API xaritasini
 *     begona skanerlarga ham ko'rsatardi.
 *
 * Bir hujjat ikki joyda ishlatiladi: jonli `/api/v1/carrier-docs` va
 * repodagi statik `docs/carrier-openapi.json` (`npm run docs:carrier-openapi`).
 * Ikkalasi ham `buildCarrierOpenApiDocument` dan chiqadi — ajralib ketmaydi.
 */

/** UI manzili (global prefiks bilan); JSON — `${CARRIER_DOCS_PATH}-json`. */
export const CARRIER_DOCS_PATH = 'api/v1/carrier-docs';

/**
 * Swagger xavfsizlik sxemasi nomi — Elchi bilan bir xil. Controller'dagi
 * `@ApiSecurity('carrier-api-key')` shu nomga ishora qiladi.
 */
export const CARRIER_API_KEY_SCHEME = 'carrier-api-key';

/** Hujjatdagi yagona teg — Elchi bilan bir xil (kod generatori klass nomi shundan). */
export const CARRIER_API_TAG = 'Carrier';

/**
 * Jonli hujjatdagi server — NISBIY: "Try it out" sahifa ochilgan host'ga
 * yuboradi (staging hujjati prod'ga so'rov yubormaydi). Yo'llar
 * `ignoreGlobalPrefix` bilan `/carrier/...` (Elchi'dagidek), `/api/v1` esa shu yerda.
 */
export const CARRIER_OPENAPI_LIVE_SERVER = '/api/v1';

/**
 * Statik spec'dagi server — `CARRIER_API.md` dagi baza manzili bilan AYNAN
 * bir xil. Aniq domenni BeePost operatori beradi (hujjatda ham shunday).
 */
export const CARRIER_OPENAPI_STATIC_SERVER = 'https://<beepost-domain>/api/v1';

/**
 * `operationId` prefiksi. Nest sukuti `${ControllerClass}_${method}` —
 * bizda `CarrierPublicController_scan` bo'lardi, Elchi'da esa
 * `CarrierGatewayController_scan`. Kod generatorlari (openapi-generator,
 * NSwag, orval) metod/klass nomini shundan yasaydi: ikkala tizimga BITTA
 * kod bilan ulangan kompaniyaning generatsiya qilingan klienti farq
 * qilmasin — operationId'lar Elchi bilan bir xil.
 */
const CARRIER_OPERATION_ID_PREFIX = 'CarrierGatewayController';
const CARRIER_PUBLIC_CONTROLLER = 'CarrierPublicController';

/** Hujjatga faqat shu prefiksli yo'llar kiradi (admin `carrier-accounts` kirmaydi). */
const CARRIER_PATH_PREFIX = '/carrier/';

/**
 * Qisqa qo'llanma — Swagger sahifasining tepasida ko'rinadi (Elchi
 * `CARRIER_SWAGGER_GUIDE` ning BeePost nashri). To'liq kontrakt va Elchi'dan
 * farqlar — `CARRIER_API.md` (Ilova A — BeePost profili). Matn
 * `CARRIER_API.md` bilan zid bo'lmasligi kerak: misollar, kalit prefiksi va
 * qoidalar o'sha hujjatdan olingan.
 */
export const CARRIER_SWAGGER_GUIDE = `BeePost posilkalarini yetkazadigan tashqi kompaniya uchun API. Elchi Pochta Carrier API bilan **bir xil kontrakt**: yo'llar, maydonlar, javob shakllari va xato \`code\` lari bir xil — farq baza manzili, kalit va "BeePost profili" (\`CARRIER_API.md\`, Ilova A). BeePost'da siz **bitta kurier akkaunti** sifatida ishlaysiz: BeePost xodimi pochtani sizga jo'natadi, siz posilka QR'ini skanerlaysiz va yetkazish natijasini yuborasiz. Pul sizning kurier kassangizga yoziladi.

## 1. Kirish

Baza manzili: \`https://<beepost-domain>/api/v1\` (aniq domenni BeePost operatori beradi). Har so'rovda \`X-Api-Key\` sarlavhasi (kalit \`bpc_\` bilan boshlanadi, uni BeePost operatori beradi). Kalit faqat bir marta ko'rsatiladi — xavfsiz saqlang.

Interaktiv hujjat: \`https://<beepost-domain>/api/v1/carrier-docs\` (login va parolni BeePost beradi). U yerda **Authorize** tugmasiga kalitni kiritib, so'rovlarni to'g'ridan-to'g'ri sinash mumkin.

\`\`\`bash
curl https://<beepost-domain>/api/v1/carrier/ping -H "X-Api-Key: bpc_..."
\`\`\`

## 2. Ish oqimi

**1) Skanerlash** — posilkani qo'lingizga olganda:

\`\`\`bash
curl -X POST https://<beepost-domain>/api/v1/carrier/scan \\
  -H "X-Api-Key: bpc_..." -H "Content-Type: application/json" \\
  -d '{"qr_token":"5f2a9c1e7b3d4a6f8e0c2b19"}'
\`\`\`

Javobda buyurtma (\`data.order\`): mijoz, manzil, tovarlar va **\`cod_amount\` — mijozdan olinadigan naqd** (BeePost'da \`= total_price\`). Viloyat va tuman nomi emas, **SOATO kodi** bilan keladi: \`region.soato_code\` (4 xona), \`district.soato_code\` (7 xona; kod noma'lum bo'lsa \`null\`). Yo'ldagi (\`on the road\`) posilka shu skanda sizga qabul qilinadi (\`status: waiting\`). Sotish va bekor qilish faqat shundan keyin mumkin. \`replacement.old_item_required: true\` — almashtirish: eski mahsulotni oling va sotishda \`old_item_collected: true\` yuboring.

**2) Natijani yuborish** — \`data.order.id\` (UUID) bilan. **\`Idempotency-Key\` majburiy** — har yangi urinish uchun yangi UUID:

\`\`\`bash
curl -X POST https://<beepost-domain>/api/v1/carrier/orders/3f6c1a2e-8b4d-4c7a-9e21-5d0b7f3a9c10/status \\
  -H "X-Api-Key: bpc_..." -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"sold"}'
\`\`\`

| status | Qachon | Qo'shimcha maydonlar |
|---|---|---|
| \`sold\` | To'liq sotildi | — |
| \`partly_sold\` | Qisman sotildi | \`total_price\` (mijoz olgan tovarlar qiymati, butun so'm), \`items: [{order_item_id, quantity}]\` — buyurtmaning har bir qatori |
| \`cancelled\` | Mijoz olmadi | \`reason\`: \`CUSTOMER_NO_ANSWER\`, \`CUSTOMER_REFUSED\`, \`WRONG_ADDRESS\`, \`DEFECTIVE_PRODUCT\`, \`PRICE_DISPUTE\`, \`OTHER\` (+ \`comment\`) |
| \`rollback\` | Xato yuborilgan sold/cancelled ni qaytarish | — (holat aynan sold yoki cancelled bo'lsa) |

**3) Bekor qilinganlarni qaytarish** — \`cancelled\` posilkalar (qisman sotuvning sotilmagan qismi ham) sizda qoladi: \`POST /carrier/returns\` \`{"order_ids":["3f6c1a2e-8b4d-4c7a-9e21-5d0b7f3a9c10"]}\` → qaytarish pochtasi (\`post_id\`); posilkalarni BeePost'ga topshirasiz. Qaytarilgan posilka \`/carrier/orders\` ro'yxatidan chiqadi.

**4) Solishtirish** — \`GET /carrier/orders\` (sizdagi buyurtmalar) va \`GET /carrier/cashbox\` (balans va oxirgi 30 kunlik harakatlar).

## 3. Muhim qoidalar

- Faqat **sizga biriktirilgan** buyurtmalar ko'rinadi; boshqasiga \`404\`. Barcha id'lar — UUID satr; UUID bo'lmagan id — \`400\`.
- \`Idempotency-Key\`: har **yangi** urinish — yangi kalit; javob kelmasa — **ayni kalit** bilan qayta yuboring (amal ikki marta bajarilmaydi). Rollback'dan keyingi qayta sotuv — yangi kalit (eskisi bilan \`409 CARRIER_IDEMPOTENCY_KEY_STALE\`).
- Limit: akkaunt uchun daqiqada 120 so'rov, barcha endpoint birgalikda (\`429\`, \`Retry-After\`). Ro'yxatni bittalab emas, sahifalab oling.
- Xato javobi: \`{ statusCode, message, code?, trace_id }\` (\`trace_id\` \`X-Trace-Id\` sarlavhasida ham). Qarorni matnga emas, \`statusCode\`/\`code\` ga qarab qiling. \`trace_id\` ni saqlang — muammo bo'lsa BeePost'ga yuboring.
- \`409\`, \`429\`, \`5xx\`, \`503\`, \`504\` — biroz kutib, **ayni** \`Idempotency-Key\` bilan qayta urining (\`CARRIER_IDEMPOTENCY_KEY_STALE\` — yangi kalit; 10 daqiqadan uzoq takrorlansa — BeePost'ga). Boshqa \`4xx\` — so'rovni tuzating.
- \`refreshed: false\` — holat qabul qilindi, buyurtmani keyinroq o'qing (qayta yubormang).

## 4. Pul

Sotuvda kassangizga **(mijozdan olingan naqd − yetkazish haqingiz)** yoziladi — bu BeePost'ga topshiriladigan summa. Naqdni topshirganingizda BeePost xodimi qabul qiladi va kassada chiqim paydo bo'ladi. Bekor qilishda pul harakati yo'q. Kassa yozuvi holat bilan **bir vaqtda** paydo bo'ladi. Rollback naqd topshirilgandan keyin ham ishlaydi — balans manfiy bo'lishi mumkin. Yo'nalish — \`type\` (income/expense), \`amount\` doim musbat.`;

export type CarrierSwaggerSetupResult =
  | 'mounted'
  | 'disabled'
  | 'disabled_no_password';

/** Hujjatdagi `$ref` larni yig'adi (ishlatilmagan sxemalarni olib tashlash uchun). */
function collectRefs(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string') {
      const name = child.split('/').pop();
      if (name) out.add(name);
    } else {
      collectRefs(child, out);
    }
  }
}

/**
 * Hujjatdan faqat `/carrier/*` yo'llarini va ular ishlatadigan sxemalarni
 * qoldiradi (Elchi `filterCarrierDocument`). Admin marshrutlari
 * (`/carrier-accounts`), boshqa teglar va xavfsizlik sxemalari (Bearer)
 * tashqariga chiqmaydi.
 */
export function filterCarrierDocument(full: OpenAPIObject): OpenAPIObject {
  const paths = Object.fromEntries(
    Object.entries(full.paths ?? {}).filter(([path]) =>
      path.startsWith(CARRIER_PATH_PREFIX),
    ),
  );

  const allSchemas = full.components?.schemas ?? {};
  const used = new Set<string>();
  collectRefs(paths, used);
  // Sxemalar bir-biriga ishora qiladi — yopilguncha kengaytiramiz.
  let size = -1;
  while (used.size !== size) {
    size = used.size;
    for (const name of [...used]) collectRefs(allSchemas[name], used);
  }
  const schemas = Object.fromEntries(
    Object.entries(allSchemas).filter(([name]) => used.has(name)),
  );

  const securitySchemes = Object.fromEntries(
    Object.entries(full.components?.securitySchemes ?? {}).filter(
      ([name]) => name === CARRIER_API_KEY_SCHEME,
    ),
  );

  return {
    ...full,
    paths,
    tags: (full.tags ?? []).filter((tag) => tag.name === CARRIER_API_TAG),
    components: { schemas, securitySchemes },
    security: [{ [CARRIER_API_KEY_SCHEME]: [] }],
  };
}

type MediaTypes = Record<string, { schema?: Record<string, unknown> }>;

/**
 * JSON va multipart so'rov tanasini AJRATADI (Elchi `splitMultipartProofBodies`).
 * `@ApiBody` bitta sxema beradi: `allOf: [DTO, { proof: binary }]` — u
 * `application/json` ga ham tushib, kod generatorlari JSON modelida `File`
 * maydonini yasardi. Endi JSON — faqat DTO, multipart — DTO + `proof`.
 */
export function splitMultipartProofBodies(doc: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values(doc.paths ?? {})) {
    for (const op of Object.values(pathItem ?? {})) {
      const content = (op as { requestBody?: { content?: MediaTypes } })
        ?.requestBody?.content;
      const json = content?.['application/json'];
      const allOf = json?.schema?.allOf as
        | Array<Record<string, unknown>>
        | undefined;
      if (!content?.['multipart/form-data'] || !Array.isArray(allOf)) continue;
      const base = allOf.find((part) => typeof part.$ref === 'string');
      if (!base) continue;
      content['application/json'] = { ...json, schema: { ...base } };
    }
  }
  return doc;
}

/**
 * `nullable: true` + `allOf: [$ref]` sxemaga `type: 'object'` qo'shadi.
 *
 * NEGA. OpenAPI 3.0.3 bo'yicha `nullable` faqat AYNI sxemada `type` bo'lsa
 * kuchga kiradi — `type` siz kod generatorlari `customer`, `region`,
 * `order` kabi maydonlarni null bo'lmaydigan deb yasaydi va `null` kelganda
 * klient yiqiladi. `@nestjs/swagger` 11.4+ `type: object` ni o'zi yozadi
 * (Elchi spec'i shunday), BeePost'dagi 11.2.0 esa yozmaydi. Kalit tartibi
 * ham Elchi'dagidek (`nullable`, ..., `type`, `allOf`) — ikki spec farqi
 * faqat mazmunda qolsin.
 */
export function normalizeNullableRefs<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => normalizeNullableRefs(item)) as T;
  }
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const needsType =
    source.nullable === true &&
    Array.isArray(source.allOf) &&
    source.type === undefined;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (needsType && key === 'allOf') out.type = 'object';
    out[key] = normalizeNullableRefs(child);
  }
  return out as T;
}

/** `operationId` — public controller uchun Elchi nomi, qolganlari Nest sukuti. */
export function carrierOperationId(
  controllerKey: string,
  methodKey: string,
): string {
  const owner =
    controllerKey === CARRIER_PUBLIC_CONTROLLER
      ? CARRIER_OPERATION_ID_PREFIX
      : controllerKey;
  return `${owner}_${methodKey}`;
}

export interface BuildCarrierOpenApiOptions {
  /**
   * Statik spec uchun `CARRIER_OPENAPI_STATIC_SERVER`. Berilmasa — jonli
   * hujjat uchun nisbiy `/api/v1`.
   */
  serverUrl?: string;
  /**
   * Skanerlanadigan Nest modullari. Jonli ilovada `[CarrierModule]` —
   * boshqa 35 controller umuman skanerlanmaydi va begona DTO nomi carrier
   * sxemasini bosib ketolmaydi. Berilmasa — butun ilova (yo'llar baribir
   * `/carrier/` prefiksi bo'yicha filtrlanadi).
   */
  include?: SwaggerDocumentOptions['include'];
}

/**
 * Carrier OpenAPI hujjati. Yo'llar global prefikssiz (`/carrier/scan`,
 * Elchi'dagidek), prefiks `servers` da — kompaniya faqat baza manzilini
 * almashtiradi.
 */
export function buildCarrierOpenApiDocument(
  app: INestApplication,
  options: BuildCarrierOpenApiOptions = {},
): OpenAPIObject {
  const docConfig = new DocumentBuilder()
    .setTitle('BeePost — Carrier API')
    .setDescription(CARRIER_SWAGGER_GUIDE)
    .setVersion('1.0.0')
    .addServer(options.serverUrl ?? CARRIER_OPENAPI_LIVE_SERVER)
    .addApiKey(
      { type: 'apiKey', name: 'X-Api-Key', in: 'header' },
      CARRIER_API_KEY_SCHEME,
    )
    .addTag(CARRIER_API_TAG, 'Tashqi yetkazuvchi endpointlari')
    .build();
  const full = SwaggerModule.createDocument(app, docConfig, {
    ...(options.include ? { include: options.include } : {}),
    ignoreGlobalPrefix: true,
    operationIdFactory: carrierOperationId,
  });
  return normalizeNullableRefs(
    splitMultipartProofBodies(filterCarrierDocument(full)),
  );
}

/** Hujjat ulanishi sozlamalari (`src/config` dan; testda to'g'ridan-to'g'ri). */
export interface CarrierDocsSettings {
  nodeEnv: string | undefined;
  /** `CARRIER_DOCS_ENABLED` — faqat production'da ahamiyatli. */
  enabled: boolean;
  user: string;
  password: string;
}

export function carrierDocsSettingsFromConfig(): CarrierDocsSettings {
  return {
    nodeEnv: process.env.NODE_ENV,
    enabled: config.CARRIER_DOCS_ENABLED,
    user: config.CARRIER_DOCS_USER,
    password: config.CARRIER_DOCS_PASSWORD,
  };
}

const sha256 = (value: string): Buffer =>
  createHash('sha256').update(value, 'utf8').digest();

type DocsRequest = {
  path?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};
type DocsResponse = {
  setHeader(name: string, value: string): unknown;
  status(code: number): { send(body: string): unknown };
};

/**
 * HTTP Basic auth — qo'lda yozilgan (yangi npm paket qo'shilmaydi).
 *
 * ⚠️ GLOBAL middleware, yo'l bo'yicha tekshiradi: Express `app.use(path)`
 * segment chegarasida moslaydi va `/carrier-docs` prefiksi
 * `/carrier-docs-json` ni QOPLAMAYDI (alohida yozish unutilsa spec parolsiz
 * ochilardi). Bu yerda UI, uning statik fayllari va `-json` — hammasi bitta
 * prefiks ostida. Express marshrutlari katta-kichik harfni farqlamaydi —
 * tekshiruv ham farqlamaydi; ketma-ket `/` lar birlashtiriladi.
 *
 * Login va parol BIRGA sha256 qilinib `timingSafeEqual` bilan solishtiriladi:
 * uzunlik va vaqt farqi orqali qaysi qismi to'g'ri ekanini bilib bo'lmaydi.
 */
export function carrierDocsBasicAuth(
  user: string,
  password: string,
  mountPath: string = CARRIER_DOCS_PATH,
) {
  const prefix = `/${mountPath.replace(/^\/+/, '')}`.toLowerCase();
  const expected = sha256(`${user}:${password}`);
  return (req: DocsRequest, res: DocsResponse, next: () => void): void => {
    const rawPath = String(req.path ?? req.url ?? '').split('?')[0];
    const path = rawPath.replace(/\/{2,}/g, '/').toLowerCase();
    if (!path.startsWith(prefix)) {
      next();
      return;
    }
    const header = req.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(value ?? '');
    const supplied = match
      ? Buffer.from(match[1], 'base64').toString('utf8')
      : '';
    if (match && timingSafeEqual(sha256(supplied), expected)) {
      next();
      return;
    }
    res.setHeader(
      'WWW-Authenticate',
      'Basic realm="BeePost Carrier API Docs", charset="UTF-8"',
    );
    res.status(401).send('Unauthorized');
  };
}

/**
 * `/api/v1/carrier-docs` (UI) va `/api/v1/carrier-docs-json` ni ulaydi.
 * `app.listen()` dan OLDIN chaqiriladi (`app.service.ts`, o'z try/catch'ida —
 * hujjat xatosi API'ni to'xtatmasin).
 */
export function setupCarrierSwagger(
  app: INestApplication,
  options: {
    settings?: CarrierDocsSettings;
    include?: SwaggerDocumentOptions['include'];
  } = {},
): CarrierSwaggerSetupResult {
  const settings = options.settings ?? carrierDocsSettingsFromConfig();
  const isProduction = settings.nodeEnv === 'production';
  if (isProduction && !settings.enabled) return 'disabled';
  if (isProduction && !settings.password) return 'disabled_no_password';

  const document = buildCarrierOpenApiDocument(app, {
    include: options.include,
  });

  if (settings.password) {
    // Swagger marshrutlaridan OLDIN — Express middleware'lari ro'yxatdan
    // o'tish tartibida ishlaydi.
    app.use(
      carrierDocsBasicAuth(settings.user || 'carrier', settings.password),
    );
  }

  SwaggerModule.setup(CARRIER_DOCS_PATH, app, document, {
    /**
     * FAQAT JSON. Sukut `raw: true` `-yaml` ni ham beradi — keraksiz
     * qo'shimcha eshik (Elchi ultracode review). Basic auth prefiks bo'yicha
     * uni ham qoplardi, lekin yo'q eshik — eng xavfsiz eshik.
     */
    raw: ['json'],
    customSiteTitle: 'BeePost — Carrier API',
    swaggerOptions: { persistAuthorization: true },
  });
  return 'mounted';
}
