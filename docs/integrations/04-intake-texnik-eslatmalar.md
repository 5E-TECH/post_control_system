<!-- Ushbu hujjat CRM→PCS intake implementatsiyasi uchun texnik ground-truth. Kod file:line havolalari tahlil paytidagi holatga tegishli. -->

# CRM → PCS buyurtma intake — arxitektura xaritasi

Barcha havolalar `server/` ga nisbatan. Xulosa: **CRM webhook uchun tayyor, ideal namuna allaqachon mavjud — `receiveExternalOrders`.** Uni qayta ishlatish (yoki undan bitta-buyurtma variantini ajratib olish) kerak, `createOrder` EMAS.

---

## 1) Qaysi metod/servisdan foydalanamiz

Ikkita nomzod bor, ular tubdan farq qiladi:

| Metod | Fayl:qator | Kirish | Mijoz | Tuman | Post | Status | Guruh-tasdiq |
|---|---|---|---|---|---|---|---|
| **`receiveExternalOrders`** | `src/api/order/order.service.ts:5533` | tashqi xom obyekt + `field_mapping` | telefon bo'yicha topadi/**yaratadi** | SATO bo'yicha topadi + fallback | region post'ga **biriktiradi/yaratadi** | **`RECEIVED`** | **YO'Q** |
| `createOrder` | `src/api/order/order.service.ts:272` | `CreateOrderDto` (ichki, UUID'lar) | `customer_id` **oldindan mavjud** bo'lishi shart (`:371`) | `district_id` UUID | biriktirmaydi | `NEW` (`:471`) | yo'q (web oqimi) |

**Tavsiya:** CRM webhook uchun **`receiveExternalOrders` naqshini qayta ishlatish**. Sabab: `createOrder` mijozni telefon bilan yaratmaydi (u faqat mavjud `customer_id` UUID qabul qiladi — `order.service.ts:371-376`), tuman UUID kutadi, post'ga biriktirmaydi. `receiveExternalOrders` esa aynan "tashqi xom yozuv → to'liq buyurtma" ni bajaradi: mijoz-upsert, telefon normalizatsiya, SATO→tuman, region post, dedup — hammasi bitta tranzaksiyada.

**Amaliy 2 variant:**
- **A (tez):** CRM'ni `external_integration` jadvaliga bitta integratsiya sifatida qo'shib (`slug`, `market_id`, `field_mapping`), webhook'ni `receiveExternalOrders`ga (`order.controller.ts:430` `POST /order/receive/external`) yo'naltirish. Faqat CRM payloadiga mos `field_mapping` sozlansa — kod o'zgarmaydi.
- **B (toza):** `receiveExternalOrders` ichidagi bitta-buyurtma yaratish blokini (`order.service.ts:5660-5872`) `private createOneExternalOrder(extOrder, ctx)` helperiga ajratib, CRM webhook shuni chaqiradi. Loop/dedup/post-cache mantiqi umumiy qoladi.

> Eslatma: hozirgi `receiveExternalOrders` **JWT + rol guard** ostida (`order.controller.ts:428-429`, `ADMIN/SUPERADMIN/REGISTRATOR`). Auth'siz CRM webhook uchun bu endpoint mos emas — LDG kabi alohida auth'siz + imzoli controller kerak (5-bo'limga qarang).

---

## 2) Majburiy maydonlar va manbalari

`receiveExternalOrders` xom obyektdan `field_mapping` orqali maydon o'qiydi (`getFieldValue`, `order.service.ts:130-133`; mapping strukturasi `external-integration.entity.ts:9-24`). Buyurtma yozuvi `order.service.ts:5848-5862` da quriladi.

**DB-darajasida haqiqiy MAJBURIY (bo'lmasa buyurtma yaratilmaydi):**

| Maydon | Manba (xom → mapping kaliti) | Fallback agar bo'lmasa |
|---|---|---|
| `user_id` (market) | `integration.market_id` (`:5565`) | integratsiyadan, CRM yubormaydi |
| `customer_id` | telefon bo'yicha upsert (`:5804-5828`) | `unknown_<ts>_<rand>` telefon (`:5781-5783`) |
| `district_id` | SATO → tuman (`:5717-5752`) | **`defaultDistrict` = `allDistricts[0]`** (`:5591`, `:5745-5746`) |
| `post_id` | region post cache/yaratish (`:5757-5778`) | region bo'yicha yangi post |
| `total_price` | `total_price_field` + `delivery_price_field` (`:5832-5834`) | `0 + 0 = 0` |
| `where_deliver` | — | `market.default_tariff \|\| CENTER` (`:5577`) |
| `status` | — | qattiq `RECEIVED` (`:5855`) |
| `qr_code_token` | `qr_code_field`, aks holda generatsiya (`:5837`) | `generateCustomToken()` |
| `product_quantity` | `total_count_field` (`:5861`) | `1` |
| `external_id` | `id_field` (`:5860`) | `String(undefined)` bo'lishi mumkin (xavf) |
| `operator` | — | `external_<slug>` (`:5859`) |

**Mijoz (UserEntity role=CUSTOMER) uchun (`:5817-5824`):** `name` (`customer_name_field`, fallback `'Tashqi mijoz'` `:5801`), `phone_number` (normalizatsiya `:5786-5799`), `district_id`, `address`, `extra_number`.

**Muhim kuzatish:** `receiveExternalOrders` **order-item YARATMAYDI** — faqat `product_quantity` sonini yozadi (`:5861`), `OrderItemEntity` yo'q. Sabab: tashqi mahsulotlar bizning `product_id` bilan bog'lanmagan. `createOrder` esa order-item yaratadi (`:495-503`) va SHU marketning mahsuloti ekanini tekshiradi (IDOR himoyasi `:445-453`). **CRM intake dizaynida qaror kerak:** mahsulotni matn sifatida saqlaymizmi (item'siz, hozirgidek) yoki CRM mahsulotini PCS `product`'ga mapping qilamizmi.

**Narx:** `finalTotalPrice = Number(total_price) + Number(delivery_price)` (`:5832-5834`). Ikkalasi ham `Number(...) || 0` — CRM narx yubormasa buyurtma **0 so'm** bo'ladi (audit uchun xavf, lekin bloklamaydi).

---

## 3) SOATO/tuman qanday aniqlanadi + SOATO yo'q bo'lsa

`DistrictEntity.sato_code` (`district.entity.ts:24`, `unique`, indexlangan `:19`) — tuman ↔ SATO bog'lovchi.

Rezolyutsiya tartibi (`order.service.ts:5717-5755`):
1. `district_code_field` dan xom qiymat olinadi, `undefined/null/'undefined'/'null'/''` filtrlanadi (`:5718-5725`).
2. **Aniq moslik:** `districtBySatoCode.get(districtCode)` — barcha tumanlar bir marta yuklab, `sato_code`→tuman xaritasi qilingan (`:5584-5590`, `:5731`).
3. **Partial moslik:** topilmasa `sato_code.endsWith(code)` yoki `.includes(code)` (`:5734-5741`).
4. **SOATO yo'q / topilmadi → `defaultDistrict = allDistricts[0]`** (`:5591`, `:5745-5752`) + `logger.warn`. Ya'ni buyurtma **tasodifiy birinchi tuman**ga tushadi (jiddiy xavf — noto'g'ri regionga marshrutlanishi mumkin).
5. Region: `targetDistrict.assigned_region || targetDistrict.region_id` (`:5754-5755`) → shu region post'iga biriktiriladi.

**CRM'da SOATO yo'q bo'lsa dizayn tavsiyasi:** hozirgi "birinchi tuman" fallback'i xavfli. CRM intake uchun tanlovlar:
- CRM tuman **nomi** yuborsa — `sato-matcher` util mavjud (`district.service.ts:24`, `matchDistricts`) — nom bo'yicha fuzzy match qilib SATO topish.
- SATO ham nom ham bo'lmasa — buyurtmani `defaultDistrict`ga tashlamay, **"tuman aniqlanmagan" flag** bilan operator navbatiga qo'yib qo'lda biriktirishga majburlash yaxshiroq (MEMORY: tuman avto-routing ataylab o'chirilgan — routing faqat operator qo'lda kuryer tanlashi bo'yicha).

---

## 4) external_id / idempotentlik

**Saqlash:** `OrderEntity.external_id` (`order.entity.ts:208-210`, `varchar nullable`, **unique EMAS**) ← CRM ID (`order.service.ts:5860`). `qr_code_token` ← CRM QR yoki generatsiya (`:5837`). `operator = 'external_<slug>'` (`:5859`) manbani belgilaydi.

**Dedup mantiqi (`order.service.ts:5599-5681`):**
- Batch oldidan barcha `external_id` va `qr_code`'lar yig'iladi (`:5600-5607`).
- DB'dan **faqat shu market + faqat AKTIV status** (`WAITING`, `ON_THE_ROAD`) bo'yicha mavjudlari `Set`'ga olinadi (`:5613-5656`) — **case-insensitive** (`LOWER(...)`).
- Har xom buyurtma uchun `external_id` yoki `qr_code` shu Set'da bo'lsa → `skippedOrders`ga qo'shib `continue` (`:5671-5681`).

**Muhim nuqta:** dedup **faqat aktiv holatlar**ni ushlaydi (`ACTIVE_DUPLICATE_STATUSES`, `:5613-5616`). Bekor/sotilgan/yopilgan bir xil `external_id` **qayta yaratiladi** — bu ataylab (mijoz qayta murojaat qilishi mumkin, `:5609-5612`). Bu bilan **DB-darajali unique constraint YO'Q** — idempotentlik faqat ilova mantig'ida. CRM webhook retry yuborsa (masalan tarmoq timeout'idan keyin) va ayni paytda ikkita so'rov parallel kelsa — dublikat yaratilishi mumkin.

**Qo'shimcha:** `checkDuplicateOrder` (`order.service.ts:5399-5531`, `POST /order/check-duplicate` `:415`) — QR/telefon bo'yicha oldindan tekshirish (operator UI uchun, avtomatik emas).

**CRM dizayn tavsiyasi:** LDG naqshidagidek qat'iy idempotentlik uchun `(source, external_id)` bo'yicha **partial unique index** (masalan aktiv statuslarda) yoki dedikatsiya jadvali qo'shish. Retry'ga bardoshli intake uchun bu zarur.

---

## 5) LDG inbound webhook — xavfsizlik/dedup naqshi (namuna sifatida)

CRM webhook auth'siz kelishi mumkin, LDG aynan shu muammoni hal qilgan — ideal shablon.

**Controller** (`ldg-webhook.controller.ts`):
- **Auth guard YO'Q** (`:18-24`) — JWT o'rniga HMAC imzo. `@ApiExcludeEndpoint` (`:32`).
- **Raw body** kerak: `main.ts`da `express.raw({type:'application/json'})` (`:20-24`), imzo verify parsingdan oldin xom stringni ko'radi (`extractRawBody` `:58-72`).
- Header'lar: signature, delivery-id, event (`:36-40`).

**Service `process()`** (`ldg-webhook.service.ts:63-183`) — tartib muhim:
1. **Header tekshiruvi:** signature/delivery-id yo'q → `400` (`:66-72`).
2. **Secret sozlanganmi:** `config.webhook_secret` yo'q → `503` (`:74-78`).
3. **HMAC-SHA256 imzo verify** (`verifyLdgSignature`, `ldg-signature.util.ts:64-112`): base = `t.d.rawBody`; `v1`=joriy secret, `v2`=eski secret (key rotation `:104-109`); **timing-safe** solishtirish (`:120-127`); **5 daqiqa timestamp tolerance** (replay himoya `:82-90`); `delivery_id` header signature ichidagi `d` bilan mos bo'lishi shart (`:78-80`).
4. **Envelope validatsiya:** JSON parse (`:90-97`), `delivery_id`+`type` majburiy (`:99-101`).
5. **Replay/dedup:** `delivery_id` PK bo'yicha `ldg_webhook_log`da bor bo'lsa → `200 "Already processed"` (idempotent, `:105-113`). Yozishda ham `delivery_id` unique violation yumshoq ishlanadi (`:681-689`).
6. **Imzo noto'g'ri** bo'lsa: log yozib `401` (`:116-127`).
7. **Master switch:** `config.is_active=false` yoki `webhook_enabled=false` → faqat log, status o'zgartirilmaydi (`:141-153`).
8. **Har doim `200` qaytarish** (xatoda ham, `:170-182`) — LDG retry qilmasligi uchun; xatolar `ldg_webhook_log`dan qo'lda qayta ishlanadi (`reprocessFromLog` `:193-256`).

**Payload parse:** `extractPackageRef` (`:348-391`) — BFS bilan **rekursiv kalit qidiruvi** (`findByKey` `:397-413`), chunki LDG maydonlarni har xil chuqurlikda joylashtiradi. `external_order_id` = bizning order UUID (`:383-385`), shipment shu bo'yicha topiladi (`ldg-shipment.service.ts:295-314`) va webhook backfill `ldg_order_id`ni bog'laydi (`:299-302`).

**CRM webhook uchun ko'chirib olinadigan naqsh:** (1) auth'siz controller + raw body + HMAC imzo + timestamp tolerance; (2) `delivery_id`/`event_id` unique bo'yicha replay-dedup jadval; (3) har doim 200 + audit log jadval; (4) master on/off switch; (5) imzoni ikki secret bilan (rotation).

---

## 6) NEW holati — guruh-tasdiqqa tushadimi?

**Tashqi buyurtmalar guruh-tasdiqqa TUSHMAYDI va NEW ham bo'lmaydi.** `receiveExternalOrders` buyurtmani to'g'ridan **`Order_status.RECEIVED`** holatida yaratadi (`order.service.ts:5855`) va darhol region **post'ga biriktiradi** (`:5852`). Ya'ni:
- `dispatchOrderForApproval` (`order.service.ts:549`) **CHAQIRILMAYDI**.
- Operator NEW navbatini ham, guruh ✅/❌ tasdiqini ham **butunlay chetlab o'tadi** — tashqi tizim allaqachon buyurtmani tasdiqlagan deb hisoblanadi.

Taqqoslash uchun qaysi oqim nima qiladi:

| Oqim | Metod | Boshlang'ich status | Guruh-tasdiq |
|---|---|---|---|
| Web/platforma | `createOrder` (`:461-483`) | `NEW` | Yo'q (`dispatchOrderForApproval` chaqirmaydi, izoh `:546-547`) |
| Telegram bot | `createOrderByBot` → `dispatchOrderForApproval` (`:891`) | `NEW`→`CREATED`(guruh)→`NEW` | **Ha** (guruh bo'lsa) |
| AI buyurtma | `dispatchOrderForApproval` (MEMORY: `1305a1cb`) | guruhsiz to'g'ridan `NEW` | guruh bo'lsa ha |
| **Tashqi/CRM** | **`receiveExternalOrders`** (`:5855`) | **`RECEIVED`** (post'da) | **Yo'q** |

`dispatchOrderForApproval` mantig'i (`:549-616`): market'da `Group_type.CREATE` guruhi bo'lsa → `CREATED` qilib guruhga yuboradi (`:582-615`); guruh yo'q/yuborilmasa → `NEW` (`:578-579`, `:595-600`) — hech qachon CREATED'da qotmaydi.

**CRM dizayn qarori kerak:** CRM buyurtmasi ham `RECEIVED` (ishonchli manba, tasdiqsiz) bo'ladimi, yoki operator/guruh ko'zdan kechirishi uchun `NEW`+`dispatchOrderForApproval` orqali o'tadimi. Hozirgi tashqi-integratsiya konvensiyasi = `RECEIVED`, tasdiqsiz. Agar CRM buyurtmalari tekshiruvni talab qilsa, `dispatchOrderForApproval`ni chaqirib `NEW`/`CREATED` oqimiga ulash mumkin (lekin u paytda post'ga darhol biriktirmaslik kerak).

---

## Qisqa yakuniy tavsiya (CRM intake poydevori)

1. **Metod:** `receiveExternalOrders` bitta-buyurtma helperiga refaktor qilinib qayta ishlatilsin (`order.service.ts:5660-5872`); `createOrder` intake uchun mos emas (mijoz-upsert yo'q).
2. **Auth:** LDG naqshi — auth'siz controller + raw body + HMAC-SHA256 imzo + timestamp tolerance + master switch (`ldg-webhook.*`).
3. **Idempotentlik:** hozirgi ilova-darajali dedup (`external_id`, faqat aktiv statuslar) zaif — CRM uchun `delivery_id`/`(source,external_id)` bo'yicha DB unique/dedup jadval qo'shilsin.
4. **SOATO fallback:** `allDistricts[0]` fallback'i (`:5591`, `:5746`) xavfli — CRM'da SOATO yo'q bo'lsa nom-match (`sato-matcher`) yoki "aniqlanmagan" flag + qo'lda biriktirish.
5. **Mahsulot:** hozirgi tashqi oqim order-item yaratmaydi (faqat `product_quantity`) — CRM mahsulotlarini PCS `product`'ga mapping qilish yoki matn saqlash bo'yicha qaror kerak.
6. **Status:** tashqi konvensiya = to'g'ridan `RECEIVED` (guruh-tasdiqsiz, post'ga biriktirilgan).