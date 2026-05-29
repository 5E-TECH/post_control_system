# LDG Cargo integratsiyasi

LDG (FCargo) — tashqi yetkazib berish provayderi. Sistemada **oddiy kuryer-user kabi** ulanadi (role: COURIER, external_provider: 'ldg'), faqat tarif belgilash, mavjud post/sotuv oqimi qayta ishlatiladi.

## Modul tuzilishi

```
ldg-cargo/
├── dto/                       # Request/response sxemalari
├── utils/
│   ├── ldg-signature.util.ts  # HMAC-SHA256 verify, replay tolerance 300s
│   └── ldg-status.mapper.ts   # LDG status → Order_status
├── ldg-api.service.ts         # Axios client (envelope unwrap)
├── ldg-shipment.service.ts    # Order ↔ LDG shipment biznes logikasi
├── ldg-webhook.service.ts     # Webhook event ishlovchisi
├── ldg-config.service.ts      # Singleton sozlama CRUD
├── ldg-webhook.controller.ts  # POST /api/v1/ldg/webhook (auth yo'q, faqat HMAC)
├── ldg-config.controller.ts   # GET/PATCH /api/v1/ldg/config (admin)
└── ldg-cargo.module.ts
```

## Database jadvallari

| Jadval | Vazifasi |
|---|---|
| `ldg_config` | Singleton — sender info, defaults, API key, webhook secret |
| `ldg_shipment` | Har order uchun LDG package_id, tracking_number, oxirgi status |
| `ldg_webhook_log` | Replay protection (delivery_id PK) + audit trail |

`users.external_provider` (varchar nullable) — kuryer "ichki" yoki "ldg" ekanligini ko'rsatadi.

## Migration

```bash
cd server
pnpm typeorm migration:run -d src/data-source.ts
```

Migration: `src/migrations/1746500000000-LdgCargoIntegration.ts`

## Sandbox testi (local)

LDG webhook ni qabul qilish uchun **public URL** kerak. Lokalda — ngrok orqali:

```bash
# Terminal 1: server
pnpm start:dev

# Terminal 2: ngrok tunnel
ngrok http 3000

# olingan URL: https://abc-123.ngrok-free.app
# LDG dashboard → Vebhuklar → endpoint URL ga shu URL + /api/v1/ldg/webhook qo'shing:
# https://abc-123.ngrok-free.app/api/v1/ldg/webhook
```

## Sozlash (admin panel)

1. Frontda `/integrations` sahifasiga o'ting → **LDG Cargo** tabi
2. To'ldiring:
   - **API base URL**: `https://api.fcargo.uz/api/client/v1`
   - **API kalit**: LDG dashboarddan olingan `X-API-Key` (test_pk_... yoki live_pk_...)
   - **Tenant domain**: LDG bergan slug (masalan `ldg`)
   - **Webhook secret**: LDG endpoint yaratilganda olingan secret
   - **Yuboruvchi (markaziy filial)**: nom, telefon, SOATO viloyat/tuman, manzil
   - **Standart paket o'lchovlari**: kelishilgan default qiymatlar (1kg, 30×20×15)
   - **LDG orqali yetkaziladigan tumanlar**: SOATO kodlari (har biri yangi qatorda)
3. **LDG kuryer-user yaratish**: alohida kuryer (role=COURIER, external_provider='ldg') yaratiladi va `tariff_home`/`tariff_center` belgilanadi. Uning ID si **ldg_courier_user_id** ga yoziladi.
4. **Faol** togglini yoqing.

## Status mapping

LDG `package.status_changed` event keladi → quyidagicha xaritalanadi:

| LDG status | Order_status | Tushuntirish |
|---|---|---|
| `created` / `NEW` | `ON_THE_ROAD` | biz LDG'ga jo'natdik, ular hali qabul qilmadi |
| `RECEIVED` | `WAITING` | LDG buyurtmani alohida qabul qildi |
| `8` ("Filialda") | `WAITING` | paket LDG filialiga yetdi (oraliq holat) |
| `IN_TRANSIT` / `OUT_FOR_DELIVERY` | `WAITING` | LDG yo'lda, qabul qilingan holicha kutadi |
| `DELIVERED` | `SOLD` | yetkazildi → `sellOrder` (kassaga pul tushadi) |
| `CANCELLED` | `CANCELLED` | LDG bekor qildi → `cancelOrder` oqimi |
| `RETURNED` | `CLOSED` | LDG qaytarib berdi → `cancelOrder` oqimi + yopildi |

Webhook signature verifier `ldg-signature.util.ts` da. Algoritm:

```
base = `${t}.${d}.${rawBody}`
v1   = HMAC-SHA256(currentSecret,  base)
v2   = HMAC-SHA256(previousSecret, base)  // key rotation davrida
```

Replay protection: `delivery_id` PRIMARY KEY orqali — takrorlangan webhook unique violation beradi va biz idempotent ravishda 200 qaytaramiz.

## Eslatmalar

- **Raw body**: `app.service.ts` da webhook URL uchun `express.raw()` yoqilgan — JSON parse qilinishidan oldin original byte stream signature verify uchun ishlatiladi.
- **Fire-and-forget jo'natish**: `OrderService.dispatchToLdg()` order yaratilgandan keyin asinxron chaqiriladi, asosiy oqimga ta'sir qilmaydi. Xato bo'lsa `ldg_shipment.last_error` da yoziladi.
- **Sezgir maydonlar**: API kalit va webhook secret `getSafe()` orqali admin panelda **qaytarilmaydi**, faqat `*_set: true` flagi ko'rsatiladi.
