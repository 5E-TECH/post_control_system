# 11. CRM voronkasidan buyurtma (6-bosqich)

> Holat: **BAJARILDI**. Audit topilmalari P5, P7, EI-10 yopildi.

## 1. Muammo

Kiruvchi webhook faqat **biz jo'natgan** posilkaning statusini yangilay
olardi. `applyWebhookToShipment` mavjud `provider_shipment` qatorini
izlaydi va topmasa `no_shipment` qaytarib to'xtaydi — ya'ni bu boshi berk
ko'cha edi.

CRM esa **teskari** ishlaydi:

```
Marketplace:  ular → tayyor buyurtma → biz
CRM:          ular → bitim voronkada yuradi → kerakli BOSQICHDA → buyurtma
```

"Voronka" va "bosqich" tushunchasi kodda **umuman yo'q** edi (P7), shu bois
uni saqlaydigan joy ham yo'q edi.

## 2. Yechim

Bitta yangi jsonb ustun — `external_integrations.inbound_order_config`:

| Maydon | Nima uchun |
|---|---|
| `enabled` | Yo'lni yoqadi. O'chirilgan bo'lsa hech narsa o'zgarmaydi |
| `deal_path` | Bitim obyekti payload ichida qayerda (`data.lead`) |
| `funnel_path` + `funnel_id` | Faqat bitta voronkani qabul qilish |
| `stage_path` + `create_on_stages[]` | **Darvoza**: qaysi bosqichda yaratiladi |
| `create_on_events[]` | Bosqich id'sini bermaydigan CRM uchun ikkinchi darvoza |

Buyurtma yaratishning **o'zi yozilmadi** — `order.receive_external` ga
topshiriladi. Nega: u yo'lda dublikat tekshiruvi, telefon normalizatsiyasi,
tuman aniqlash, mahsulot qatorlari va viloyat FK himoyasi allaqachon bor va
testlangan (EI-02/05/06/12 tuzatishlari). Ikkinchi nusxa yozilsa bir kuni
ikkisi bir-biridan uzoqlashardi.

```
CRM webhook
   ↓  imzo (HMAC) + replay tekshiruvi          ← o'zgarmadi
   ↓  applyWebhookToShipment                    ← o'zgarmadi
   ├─ posilka topildi  → status yangilanadi (eski yo'l)
   └─ no_shipment / no_paths / no_status
        ↓  applyWebhookToInboundOrder            ← YANGI
        ↓  rol = source? darvoza sozlangan?
        ↓  voronka mos? bosqich yoki hodisa mos?
        ↓  bitim id'si bor?
        ↓  order.receive_external → buyurtma NEW holatda
        ↓  skanerlab qabul qilish ro'yxatiga tushadi
```

Teskari yo'nalish **qo'shimcha ish talab qilmadi**: yaratilgan buyurtmada
`operator = external_<slug>` bo'ladi, `queueExternalStatusSync` esa aynan
shu shartga qarab sync navbatiga yozadi. Ya'ni bizning status o'zgarishi
CRM'ga o'zi qaytadi.

## 3. Uch darvoza — nega har biri kerak

### 3.1 Darvoza SHART (eng muhim qoida)

`enabled: true` bo'lsa `create_on_stages` yoki `create_on_events` dan
kamida bittasi to'ldirilishi shart — aks holda **400**.

CRM bitim hayotining har qadamida webhook yuboradi, shu jumladan mijoz
manzili va telefoni hali to'lmagan **"bitim yaratildi"** hodisasida ham.
Darvozasiz birinchi shu chala hodisa buyurtma yasardi, keyin dublikat
tekshiruvi to'g'ri ma'lumot kelganda "allaqachon bor" deb tashlab
yuborardi — natija **chala buyurtma bo'lib qotib qolardi**.

Xato **yozish vaqtida** qaytariladi, webhook vaqtida emas: operator formani
saqlayotganda tushuntirishni o'qiydi, kechasi kelgan hodisa logidan izlab
yurmaydi.

### 3.2 Rol darvozasi

Buyurtma faqat `role='source'` orqali kiradi. Kargo bizga buyurtma
bermaydi — biz unga beramiz. Kargo ulanishida bu yo'l yoqilgan bo'lsa,
kargoning status webhooki buyurtma yasardi.

### 3.3 Bitim id'si darvozasi

`receiveExternalOrders` dublikatni `(external_id, operator)` bo'yicha
tekshiradi, **lekin `external_id` null bo'lsa tekshiruvni butunlay
o'tkazib yuboradi**. Tortib olish yo'lida bu chidamli edi — importni
operator qo'lda ishga tushiradi. CRM webhooki esa to'xtovsiz keladi, ya'ni
id bo'lmasa **bitta bitim o'nlab buyurtma yasardi**.

Kalit nomi `field_mapping.id_field` dan olinadi — order-service'dagi ayni
sukut qiymati bilan (`'id'`), aks holda darvoza soxta bo'lardi.

## 4. Natijalar jurnalda

| Natija | Jurnalda | Ma'nosi |
|---|---|---|
| `inbound_created` | toza | buyurtma yaratildi |
| `inbound_duplicate` | toza | bitim allaqachon buyurtmaga aylangan |
| `inbound_stage_skipped` | toza | bitim boshqa bosqichda yuribdi |
| `inbound_other_funnel` | toza | boshqa voronkaning bitimi |
| `inbound_failed` | **xato** | yaratish yiqildi (masalan `market_id` yo'q) |
| `inbound_no_gate` | **xato** | darvoza sozlanmagan |
| `inbound_wrong_role` | **xato** | rol `source` emas |
| `inbound_no_deal` | **xato** | `deal_path` xato |
| `inbound_no_stage` | **xato** | `stage_path` xato |
| `inbound_no_external_id` | **xato** | bitim id'si yo'q |

Birinchi to'rttasi **asosiy oqim** — CRM bitimni bosqich o'zgargan sayin
yuboradi. Ularni xato deb belgilasak jurnal soxta ogohlantirish bilan
to'lib, haqiqiy xato ko'rinmay qolardi.

## 5. Webhook HAR DOIM 200 qaytaradi

Non-2xx bo'lsa CRM qayta yuborishni boshlaydi va navbatini to'ldiradi —
holbuki muammo sozlamada (`market_id` yo'q, `deal_path` xato) va qayta
yuborish yordam bermaydi. Hodisa jurnalga yoziladi, qaror bizda.

### Replay himoyasi

`webhook_id_header` bermaydigan CRM'da replay himoyasi **o'chiq** bo'ladi —
`receiveWebhook` faqat ogohlantirish yozadi. Buyurtma yaratish yo'lida esa
bu xavf **yopilgan**: imzolangan hodisani qayta yuborish `external_id`
dublikat tekshiruviga urilib `inbound_duplicate` bo'ladi. Ya'ni bitim id'si
darvozasi bir vaqtda replay himoyasi ham.

Posilka statusini yangilash yo'lida bu himoya yo'q — u yerda
`webhook_id_header` ni sozlash tavsiya etiladi.

## 5.1 Bitim o'zgarsa nima bo'ladi

CRM'da bitim tahrirlanib qayta yuborilsa (masalan manzil tuzatilsa), biz uni
**dublikat** deb tashlaymiz va o'zgarish bizga kelmaydi.

Bu **ataylab** — `00-umumiy-arxitektura.md` dagi qaror: *"Intakedan keyin
PCS = yetkazish avtoriteti; CRM'dagi keyingi o'zgarishlar qayta
sinxronlanmaydi; idempotent: 1 CRM yozuvi = 1 buyurtma"*. Aks holda kuryer
yo'lda ketayotganda manzil o'zgarib ketishi mumkin edi.

Operatsion oqibati: bitim buyurtmaga aylangandan keyin tuzatish **bizda**
qilinadi, CRM'da emas. Operatorlar shuni bilishi kerak.

## 6. Ataylab QILINMAGAN ish

**CRM bosqichi → bizning buyurtma statusi** (teskari inbound yo'nalish).
Bugun CRM'da bitim "yo'qotildi" bo'lsa bizdagi buyurtma bekor bo'lmaydi.

Nega qilinmadi: bu pul bilan bog'liq. Audit EI-08 ga ko'ra webhook bilan
"sotildi" bo'lgan buyurtma **kassaga tushmaydi** va keyin qo'lda ham
sotib bo'lmaydi. Ya'ni bu yo'lni ochishdan oldin EI-08 tuzatilishi va
"CRM bekor qilsa pul nima bo'ladi" degan **biznes qarori** kerak.

Chiquvchi yo'nalish (biz → CRM) ishlaydi.

## 7. Adversarial tekshiruv natijasi

Kod yozilgandan keyin 4 xil linza bilan (takror/oqim, xavfsizlik,
sozlama/jimgina ishlamaslik, ma'lumot butunligi) qidiruv, so'ng har bir
kritik da'voni **rad etishga** urinadigan skeptik tekshiruv o'tkazildi:
**22 kritik/high topilma, 8 tasdiqlandi, 4 rad etildi** (rad etilganlarning
ikkitasi tekshiruv davomida tuzatilgani uchun).

### Tuzatilganlar

| # | Muammo | Yechim |
|---|---|---|
| 1 | **Bitta bitimdan IKKI buyurtma.** Dublikat tekshiruvi o'qiydi → RMQ chaqiruvlari → yozadi; oyna yuzlab ms. CRM bitta harakat uchun bir nechta webhook yuboradi va hammasi ayni bosqichni tashiydi | Yangi `inbound_deal_refs` jadvali + **UNIQUE** `(integration_id, deal_id)`. Band qilish **yaratishdan oldin**; yaratish yiqilsa band qilish bekor qilinadi |
| 2 | **Imzolanmagan sarlavha darvozani ocharkan.** HMAC faqat tanani qamraydi; `extractEventType` esa `x-event` sarlavhasini tanadan ustun qo'yardi → bitta imzolangan tanani qo'lga olgan odam bosqich darvozasini chetlab o'tardi | Darvoza faqat **imzolangan tanadan** o'qiydi (`extractEventTypeFromBody`) |
| 3 | **Narx `NaN` bo'lib bazaga yozilardi.** `Number('250 000')` → `NaN`, Postgres `numeric` uni qabul qiladi → market hisobi, kassa, dashboard hammasi buzilardi | `safeExternalAmount` — son bo'lmasa qator tashlanadi (`price_invalid`) |
| 4 | **Har bir CRM buyurtmasi tasodifiy tumanga.** Moslik faqat SOATO/ID bo'yicha (nom bo'yicha EMAS), mos kelmasa zaxira = jadvaldagi **birinchi** tuman. Tuman viloyat va tarifni belgilaydi | Qat'iy rejim: `district_unresolved` bilan tashlanadi |
| 5 | **Narx kaliti mos kelmasa COD 0** | Qat'iy rejim: `price_missing` |
| 6 | **Payload skan tokenini boshqarardi** — dublikat token skanerlashni boshqa buyurtmaga burardi | To'qnashuv tekshiruvi (`qr_code_conflict`). Maydonning o'zi qoladi: tashqi sayt o'z shtrix-kodini bosib chiqarishi qonuniy oqim |
| 7 | **Timeout'da "yiqildi" deb yozilardi** va band qilish bekor qilinardi — holbuki buyurtma yaratilgan bo'lishi mumkin | TTL 30s; `inbound_timeout` (alohida natija), band qilish **saqlanadi** |
| 8 | **`inbound_failed` sababi saqlanmasdi** — `market_id yo'q` va `telefon yo'q` jurnalda bir xil ko'rinardi | Sabab jurnalga yoziladi: `apply: inbound_failed — <sabab>` |
| 9 | **`market_id`/rol yozish vaqtida tekshirilmasdi** — forma saqlanardi, keyin har bir bitim yiqilardi | `assertInboundOrderPrereqs` — create va update'da |
| 10 | **Bitta voronka maydonini tahrirlash butun sozlamani o'chirardi** (backend jsonb'ni almashtiradi) | UI bir ildiz ostidagi **barcha** kalitni yuboradi |
| 11 | **Uzun imzolanmagan sarlavha audit yozuvini jimgina o'chirardi** (`INSERT` yiqilib, xato yutilardi) | `clampHeader` — 255 belgiga kesiladi |
| 12 | **Yo'l maydoni satr bo'lmasa webhook TypeError bilan yiqilardi** | Yozish vaqtida tip tekshiruvi |
| 13 | **`funnel_path` xato yozilsa jurnalda hech narsa ko'rinmasdi** | `inbound_no_funnel` (diagnostika) — "boshqa voronka" dan ajratildi |
| 14 | **Kiruvchi jurnalni O'QIYDIGAN yo'l umuman yo'q edi** — butun diagnostika bazada qolardi | `GET integrations/webhook-logs` + "Kiruvchi webhooklar" jadvali. Tana qaytarilmaydi (PII) |

### Tasdiqlangan, tuzatilmagan

- **Telefon orqali boshqa marketning mijoz PII'si.** `identity.customer.create`
  telefon bo'yicha mavjud mijozni qaytaradi, mijozlar esa global. Bu import
  yo'lining eski xossasi va alohida qaror talab qiladi (mijoz per-market
  bo'lishi kerakmi?).
- **Tortib olish yo'lida zaxira tuman va 0 narx** hamon amalda: qat'iy rejim
  faqat CRM yo'lida yoqilgan. Uni hamma joyda yoqish 3-bosqichda ulangan
  saytlarning xatti-harakatini o'zgartiradi — **biznes qarori**.
- **amoCRM/Bitrix24 webhooki `form-encoded` va HMAC imzosiz.** Ya'ni bu
  mexanizm imzolangan JSON yubora oladigan CRM bilan ishlaydi (ko'pchilikda
  "custom integration" orqali mumkin), quticha holidagi amoCRM/Bitrix bilan
  esa **adapter** kerak bo'ladi. `01-bitrix24.md` va `02-amocrm-kommo.md`
  bu farqni allaqachon tasvirlaydi.

## 8. Testlar

`apps/integration-service/src/integration-service.crm-inbound.spec.ts` —
39 test, `order-service.external-import.spec.ts` — 19 test. Qamrab olinganlar: uchta darvoza, raqamli bosqich id'si, bir
elementli massivni ochish, ko'p elementli massivni **rad etish** (jimgina
yo'qotish eng yomon holat), dublikat, order-service yiqilishi, mavjud
posilka yo'lining buzilmasligi, sozlama validatsiyasining 7 holati.
