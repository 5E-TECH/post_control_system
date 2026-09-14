# 12. Onlayn to'lov tizimi (7-bosqich)

> Holat: **1-QATLAM BAJARILDI**. Audit topilmalari P1, P2 yopildi.
> Pul harakati (kassa, market qarzi, kuryer tarifi) — **ochiq**, biznes
> qaroriga bog'liq.

## 1. Muammo

`role='payment'` bazaga yozilardi, lekin undan keyin **hech qayerda
o'qilmasdi**. Auditning "faqat bitta joyda uchraydi" da'vosi qisman
noto'g'ri edi — rol qiymati 7 joyda bor (tip, normalizator, Swagger enum,
DTO), lekin `role === 'payment'` bo'yicha **pozitiv shoxlanish 0 ta**.
Mavjud uch darvoza esa uni **aktiv rad etardi**:

| Darvoza | Shart |
|---|---|
| Kiruvchi buyurtma yo'li | `role !== 'source'` → rad |
| Posilka jo'natish | `role !== 'carrier'` → rad |
| Posilka status webhooki | posilka topilmadi → `no_shipment` |

Natija: to'lov hodisasi imzo tekshiruvidan o'tib, `no_shipment` →
`inbound_wrong_role` bo'lib, **HTTP 200** olardi va **jimgina yo'qolardi**.
Provayder muvaffaqiyat deb hisoblab qayta yubormasdi.

## 2. Qurilgan qatlam

```
To'lov webhooki
   ↓  imzo (HMAC) + kill-switch                 ← o'zgarmadi
   ↓  role === 'payment' ?                       ← YANGI, posilka yo'lidan OLDIN
   ↓  payment_config darvozalari
   ↓  tranzaksiya id, summa, holat, buyurtma havolasi
   ↓  status_map: ularning holati → bizning holat
   ↓  payment_transactions ga BAND QILISH (UNIQUE)
   ↓  order.payment.record
   ↓  buyurtmada paid_online_amount + payment_status
```

**Nega to'lov shoxi posilka yo'lidan oldin:** to'lov hodisasida posilka
**yo'q**. Mijoz pul to'lagan — bu jo'natma haqidagi xabar emas.

### Yangi saqlash joylari

| Joy | Nima uchun |
|---|---|
| `orders.paid_online_amount` (`numeric(14,2)`) | Mijoz onlayn to'lagan summa. `paid_amount` bilan **aralashtirmaslik kerak** — u market qarzining to'langan qismi, mijoz puli emas |
| `orders.payment_status` (`varchar(32)`) | `paid` \| `partly` \| `refunded` \| `null`. `Order_status.PAID`/`PARTLY_PAID` bilan aralashtirmaslik: ular **market** hisob-kitobi haqida |
| `payment_transactions` | Har bir to'lov hodisasi. **UNIQUE** `(integration_id, provider_transaction_id)` |
| `external_integrations.payment_config` | Payload yo'llari + holat xaritasi + tiyin bayrog'i |

⚠️ **Tip tanlovi:** `to_be_paid` va `paid_amount` — eski **`int`** ustunlar,
ya'ni tiyin saqlamaydi. Yangi maydon `total_price` bilan bir xil
(`numeric(14,2)`), aks holda to'lov tizimidan kelgan tiyinli summa jimgina
yumaloqlanardi.

## 3. Uchta darvoza va nega har biri kerak

### 3.1 Holat xaritasi SHART

Provayderlarning qiymatlari butunlay boshqacha: `"paid"`, `2`,
`"CONFIRMED"`. Taxmin qilib bo'lmaydi. Xaritasiz **hech bir hodisa
qo'llanmaydi** — noma'lum qiymatni "to'landi" deb o'qish eng xavfli xato
bo'lardi: kuryer naqd yig'masdi, pul esa kelmasdi.

Faqat `succeeded` va `refunded` buyurtmaga tegadi. `pending` — to'lov
tizimi tranzaksiyani **band qilgan**, pul hali kelmagan.

### 3.2 Tiyin — 100 baravar xato

Payme/Click summani **tiyinda** yuboradi: 100 000 so'm → 10 000 000.
`amount_in_tiyin` qo'yilmasa summa buyurtma narxidan 100 baravar oshib,
ortiqcha to'lov darvozasiga urilardi — ya'ni **har bir to'lov rad
etilardi** va sabab uzoq izlanardi.

### 3.3 Dublikat — UNIQUE, qo'llashdan oldin

To'lov tizimlari bir hodisani qayta-qayta yuboradi — bu ularning **normal
xatti-harakati**. Pulni ikki marta qo'llash eng qimmat xato bo'lardi, shu
bois yozuv **qo'llashdan oldin** band qilinadi (6-bosqichdagi
`inbound_deal_refs` naqshi).

**Timeout alohida:** javob kelmasa yozuv **o'chirilmaydi** — buyurtma
yangilangan bo'lishi mumkin. O'chirsak keyingi nusxa to'lovni ikki marta
qo'llardi.

## 4. Rad etiladigan holatlar — hammasi ko'rinadi

| Natija | Nega rad etiladi |
|---|---|
| `order_already_closed` | Buyurtma sotilgan → **kuryer naqd yig'ib bo'lgan**. Ustiga onlayn to'lovni qo'shsak mijoz ikki marta to'lagan bo'lib chiqadi. Qaytarish kerak — **odam qarori** |
| `amount_exceeds_total` | Summa narxdan oshdi → eng ehtimolli sabab to'lovning **noto'g'ri buyurtmaga** moslashtirilgani |
| `amount_invalid` | Son emas, nol yoki manfiy |
| `order_not_found` | Havola mos kelmadi. Yozuv **saqlanadi** — pul kelgan |
| `order_ref_missing` | Havola yo'q. Yozuv **saqlanadi** |
| `ignored_status` | `pending`/`failed` — kutilgan oqim |

## 5. Sotuv oqimi to'lovni HURMAT QILADI — to'xtash orqali

`sellOrder` boshida yangi darvoza: `payment_status` to'lgan bo'lsa **400**.

**Nega to'xtatiladi, nega "jimgina hisoblab" o'tmaydi.** Butun kassa
matematikasi kuryer **naqd yig'ganiga** tayanadi:

```
courierIncome = total_price − courierShare   ← kuryer topshiradigan naqd
market        = total_price − market_tariff
branchNet     = total_price − courierShare − branchShare
```

Onlayn to'langan bo'lsa naqd yo'q, lekin formulalar o'zgarmaydi — ya'ni
kuryer **yig'magan** pulni topshirgandek yozilardi va kassa balansi
jimgina buzilardi. Bu turdagi xato eng qimmat: xato chiqmaydi, faqat
raqamlar noto'g'ri bo'ladi.

⚠️ **Bugun bu holat yuzaga kelmaydi** — hech bir provayder ulanmagan, ya'ni
`payment_status` hech qachon to'lmaydi. Darvoza provayder ulangan **kuni**
ishlaydi.

## 6. Foydalanuvchi qarorlari (2026-09-13) va ularning oqibati

| Qaror | Tanlov |
|---|---|
| Provayder | Umumiy qatlam (aniq provayder keyin) |
| Onlayn pul qaysi kassaga | **Hech qaysi** — faqat daftarga |
| Marketga qarz | **Yozilmaydi** — market provayder bilan o'zi hisoblashadi |
| Kuryer tarifi | HQ dan kassasiga kirim |

⚠️ **ANIQ AYTILGAN ZIDDIYAT.** Onlayn pul kassaga yozilmasa, lekin kuryer
tarifi HQ'dan to'lansa — kompaniya balansi **faqat chiqimni** ko'radi.
Ya'ni har onlayn buyurtmada balans kuryer tarifi miqdorida **pasayadi**.
Ustiga marketdan yetkazish haqini undiradigan maydon kodda **yo'q**.

Shu sababli kuryer tarifi to'lovi **implementatsiya qilinmadi** — u
`sellOrder` ichida bo'lishi kerak, u yerda esa darvoza turadi. Pul modeli
kelishilgach ikkisi birga yoziladi.

⚠️ **Umumiy qatlam xavfi.** 6-bosqichda aynan shu tuzoqqa tushilgan:
umumiy HMAC qatlami amoCRM/Bitrix'ga mos kelmadi. Payme/Click ham mos
kelmaydi — ular **ikki fazali JSON-RPC Merchant API** (Basic-auth,
`CheckPerformTransaction` → `CreateTransaction` → `PerformTransaction`),
bitta imzolangan webhook emas. Qatlam adapter qo'shishga tayyor shaklda
qurildi, lekin **Payme/Click uchun adapter kerak bo'ladi**.

## 7. Yo'l-yo'lakay tuzatilgan uch xato

Bular to'lovga bog'liq emas, lekin to'lovdan **oldin** tuzatilishi shart edi:

1. **Replay poygasi (audit P1).** `receiveWebhook` avval `delivery_id` ni
   tekshiradi, keyin jurnalga yozadi. Poyga oynasida ikkinchi nusxa
   oldindan tekshiruvdan o'tardi; unikal indeks uni ushlardi, lekin
   `saveWebhookLog` xatoni **yutib** `null` qaytarardi va oqim **davom
   etardi** — hodisa ikki marta qo'llanardi. Status yangilash uchun zararsiz
   (idempotent), **pul uchun halokatli**. Endi `'duplicate'` qaytariladi va
   oqim to'xtaydi. Boshqa yozuv xatosi (ulanish uzilishi) esa oqimni
   to'xtatmaydi — aks holda haqiqiy hodisa jimgina yo'qolardi.

2. **Hamkor kontraktidagi yolg'on izoh.** `cod_collected` haqida "kuryer
   mijozdan haqiqatan yiqqan pul" deb yozilgan edi. Kod teskarisini
   qiladi: `paid_amount` — **market qarzining** avtomatik to'langan qismi
   va oddiy sotuvda 0 bo'lib qoladi. Pul nomuvofiqligini tekshirgan odamni
   chalg'itardi.

3. **`webhook_payload_paths` nomuvofiqligi.** UI `order_id` ni so'rardi —
   backend uni **hech qachon o'qimaydi**; backend o'qiydigan
   `tracking_number` esa UI'da **taklif qilinmasdi**. DTO ichki kalitlarni
   tekshirmaydi, shuning uchun noto'g'ri kalit jimgina saqlanardi.

## 8. Adversarial tekshiruv — 11 ta tuzatish

5 linza (dublikat, summa, moslash, ko'rinish, regressiya) bilan qidiruv,
so'ng har bir kritik da'voni **rad etishga** urinadigan skeptik tekshiruv:
**48 topilma (21 kritik/high), 9 tasdiqlandi, 1 rad etildi**
(rad etilgani — tekshiruv davomida tuzatilgani uchun).

### Eng jiddiy ikkitasi

**1. Ustun nomi — har bir INSERT yiqilardi.** Migratsiya jadvalni
`"isDeleted"` bilan yaratardi, `BaseEntity` esa `is_deleted` yozadi
(`@Column({ name: 'is_deleted' })`). Natija: `42703 undefined_column`, ya'ni
butun dizayn tayangan UNIQUE dublikat to'sig'i **bir marta ham
yozilmasdi** — pul kelib, tizimda hech qanday iz qolmasdi.

⚠️ **Bu xato 6-bosqichda ham bor edi va DEPLOY qilingan**
(`inbound_deal_refs`) — ya'ni CRM voronkasidan buyurtma yaratish yo'li
webhook'da 500 qaytarardi. Amalda zarar yo'q edi (hech bir CRM ulanmagan),
lekin tuzatish `1716000000041` bilan qilindi (idempotent `RENAME`).

Nega hech qanday test ushlamadi: `synchronize: false` (TypeORM ustunni o'zi
qo'shmaydi), unit testlar repozitoriyani mock qiladi, migratsiya↔entity
muvofiqligini tekshiradigan joy yo'q edi. Endi bor:
`migration-soft-delete.guard.spec.ts` barcha migratsiyani skanerlaydi.

⚠️ **Tuzoqning sababi assimetriya:** `createdAt`/`updatedAt` **haqiqatan**
camelCase ustunlar (ularda `name:` yo'q), faqat `isDeleted` qayta
nomlangan.

**2. Idempotentlik kaliti tranzaksiyaning IKKINCHI hodisasini yo'qotardi.**
To'lov tizimi bitta tranzaksiya uchun bir nechta hodisa yuboradi va
hammasi **ayni id** bilan keladi:

```
CreateTransaction   → pending
PerformTransaction  → succeeded    ← pul aynan shunda keladi
CancelTransaction   → refunded
```

Kalit faqat tranzaksiya id'si edi — ya'ni `pending` qatorni band qilib
qo'yardi va **pul kelgan `succeeded` "dublikat" deb tashlanardi**. Kalit
`(integration_id, provider_transaction_id, status)` ga o'zgartirildi.

### Qolgan to'qqizta

| # | Muammo | Yechim |
|---|---|---|
| 3 | `order.payment.record` `executeAndAck` ishlatardi. RMQ **at-least-once**: ack yo'qolsa xabar qayta keladi va summa **kumulativ** oshadi | `runIdempotent`, kalit = tranzaksiya + holat (barcha boshqa pul handlerlari shunday) |
| 4 | `partlySellOrder` darvozani tekshirmasdi — ayni kassa matematikasini bajaradi, ya'ni chetlab o'tishning tayyor yo'li | `assertNotOnlinePaid` ikki joyda |
| 5 | Summa **locksiz** "o'qi → hisobla → yoz" — bir buyurtmaga ikki to'lov kelsa biri ikkinchisini ustiga yozardi | SQL ichida oshirish + chegara `WHERE` ichida (atomik) |
| 6 | **Qaytarish yopilgan buyurtmada imkonsiz** — "yopilgan" darvozasi qaytarishdan oldin turardi, ya'ni bekor qilingan buyurtmaning qaytarilgan puli struktura jihatdan yozib bo'lmasdi | Qaytarish darvozadan o'tadi (u majburiyat yaratmaydi, kamaytiradi) |
| 7 | Havolasiz to'lov `amount: 0` bilan yozilardi — pulni kuzatish uchun yaratilgan **yagona qator summani yo'qotardi** | Summa havoladan oldin o'qiladi |
| 8 | `external_id`/`qr_code_token` **UNIQUE emas**, `findOne` tartibsiz bittasini olardi → to'lov **boshqa mijozning** buyurtmasiga | `find({ take: 2 })`, ikkita bo'lsa `order_ref_ambiguous` |
| 9 | **Tenant bog'lanishi yo'q** — istalgan to'lov ulanishi istalgan marketning buyurtmasini "to'langan" deb belgilay olardi | Ulanishda `market_id` bo'lsa moslik talab qiladi |
| 10 | `payment_disabled` diagnostika ro'yxatida yo'q edi — jurnalda **muvaffaqiyatdan farq qilmasdi** | Ro'yxatga qo'shildi |
| 11 | Entity docblogi "yiqilsa qator o'chiriladi" deb va'da qilardi, kod o'chirmaydi | Docblok tuzatildi: pulda o'chirish **ataylab** qilinmaydi (o'chirish ikkinchi nusxaga qayta qo'llash yo'lini ochardi) |

### Tasdiqlangan, tuzatilmagan

- **Vaqtinchalik xatolik to'lovni abadiy "qo'llanmagan" qoldiradi.** Qayta
  urinish yo'li yo'q. Qo'lda qayta urinish endpointi **ataylab
  qo'shilmadi**: agar birinchi urinish aslida muvaffaqiyatli bo'lgan bo'lsa
  (timeout), qayta urinish pulni **ikki marta** qo'llardi. Hozircha
  to'lovlar ro'yxatida ko'rinadi va qo'lda hal qilinadi.
- **Onlayn to'langan buyurtmani bekor qilishni hech narsa to'smaydi** —
  qaytarish majburiyati hech qayerda yozilmaydi. Bu siyosat qarori.
- **Bir tranzaksiyaning ikki qismiy qaytarishi** (ayni id, ayni holat)
  ikkinchisi tashlanadi — takroriy yetkazishni yo'qotish qaytarishni ikki
  marta qo'llashdan xavfsizroq.

## 9. Testlar

| Fayl | Soni | Nimani qulflaydi |
|---|---|---|
| `order-service.online-payment.spec.ts` | 40 | `pending` qo'llanmasligi, summa chegaralari, yopilgan buyurtma, qaytarish, havola oq ro'yxati, sotuv darvozasi |
| `integration-service.payment-webhook.spec.ts` | 22 | darvozalar, tiyin, dublikat, band qilish tartibi, timeout, ko'rinish |
| `integration-service.webhook.spec.ts` | +2 | replay poygasi (P1) |
| `order-payment-fields.spec.ts` | 5 | to'lov maydonlari qo'lda o'zgartirilmasligi |
| `migration-soft-delete.guard.spec.ts` | 88 | barcha migratsiya soft-delete ustunini to'g'ri nomlashi |
| `payments.test.ts` (FE) | 7 | qo'llanmagan to'lov neytral ko'rinmasligi |
| `connections.test.ts` (FE) | +6 | tiyin bayrog'i, holat xaritasi, posilka yo'llari yo'qligi |
