# 08 — BeePost posilkalarini SKANER bilan qabul qilish

> Holat: **REJA — 3 qaror qabul qilingan, ishga ruxsat KUTILMOQDA.** Kod yozilmagan.
> Sana: 2026-09-12. Tayanch: 05-elchi.md, 07-pilot.md.

---

## 1. Muammo

Hozir BeePost'dan Elchi kuryerga buyurtma jo'natilsa, u **darhol** Elchi
tizimida paydo bo'ladi:

```
PCS "Elchi kuryerga jo'nat"
   │
   ├─ POST /partner/shipments        (X-Api-Key)
   │
   └─ Elchi: order.create → status = NEW      ◄── muammo shu yerda
              │
              └─ "Yangi buyurtmalar" ro'yxatida DARHOL ko'rinadi
                 (findNewMarkets / findNewOrdersByMarket: status = NEW)
```

Bu shunchaki UI bezovtaligi emas. **Javobgarlik (custody) buzilgan:**
posilka hali BeePost omborida turganda, Elchi xodimi uni skanerlamasdan
"qabul qildim" deb belgilay oladi. Ya'ni Elchi **qo'lida bo'lmagan**
posilka uchun javobgarlikni oladi. Yo'qolsa — kim aybdor, aniqlanmaydi.

---

## 2. Kerakli oqim

```
PCS jo'natadi
   │
   └─ Elchi: order.create → status = CREATED  + "kutilmoqda" belgisi
              │
              ├─ Operatsion ro'yxatlarda YO'Q
              ├─ Hech kim qabul qila olmaydi
              └─ Faqat "Kutilayotgan posilkalar"da ko'rinadi (ma'lumot uchun)
   │
   ▼
Operator → Skanerlash sahifasi → BeePost tanlaydi → chekni skanerlaydi
   │
   └─ HAR SKAN DARHOL:
        CREATED → RECEIVED
        + pochtaga avtomatik ajratish (logistics.post.receive_orders)
        + ro'yxatga yoziladi:  #100042 · Asaka · Pochta: Andijon-3
```

Ikkinchi qadam yo'q. "Qabul qilish" tugmasini bosish yo'q.

---

## 3. Nega yangi status EMAS, balki `CREATED`

Uch sabab — hammasi kodda tekshirilgan:

| # | Sabab | Dalil |
|---|-------|-------|
| 1 | `CREATED → RECEIVED` **allaqachon ruxsat etilgan** | `order-status.machine.ts:15` |
| 2 | Barcha "yangi buyurtma" ro'yxatlari `status = NEW` filtri bilan ishlaydi — CREATED ular ichidan **o'z-o'zidan** chiqib ketadi | `order-service.service.ts:686, 726` |
| 3 | **PCS `created`ni allaqachon "yo'lda" deb tushunadi** — nomuvofiqlik belgilanmaydi | `elchi-status.mapper.ts:44-48` |

3-band eng qimmatlisi: PCS tomonida status bo'yicha **hech narsa
o'zgartirilmaydi**. Reconcile CRON soxta "mismatch" chiqarmaydi.

⚠️ Lekin `CREATED` Elchi'da allaqachon ma'noga ega: *"market yaratdi, hali
topshirmadi"* (`order-lifecycle.service.ts:5623` — bu holatda buyurtmani
faqat egasi market o'chira oladi). Shu bois hamkor posilkasi **faqat
status bilan** ajratilmaydi — `source='external'` va `partner_shipment_ref`
bilan birga aniqlanadi, ustiga aniq belgi qo'yiladi.

---

## 4. ⚠️ TOKEN MUAMMOSI — bu topilmasa butun ish behuda ketardi

Operator **BeePost chekini** skanerlaydi. O'sha chekdagi QR qiymati —
**PCS'ning** `qr_code_token`i (`order-details/index.tsx:519` → `value={token}`).

Elchi esa `order.create`da **o'zining** tokenini yaratadi
(`generateCustomToken()`) va PCS tokeni haqida hech narsa bilmaydi.
Hozirgi "Kiruvchi posilkalar" sahifasi esa aynan Elchi tokeni bilan
solishtiradi (`incoming-orders/index.tsx:99` → `order.qr_code_token`).

> **Xulosa:** hozirgi sahifada BeePost chekini skanerlash **hech qachon
> mos kelmaydi.** U sahifa Elchi'ning o'z tokeniga qarab yozilgan va
> haqiqiy posilka bilan ishlay olmaydi.

Ikki tokenning shakli **bir xil** — 24 belgili kichik hex:

| Tizim | Generator | Natija |
|-------|-----------|--------|
| PCS | `randomBytes(12).toString('hex')` | 24 hex |
| Elchi | 24 × `abcdef0123456789` | 24 hex |

Ya'ni saqlashda o'rin almashtirish mumkin, lekin **ko'rinishidan
ajratib bo'lmaydi** (shakl bo'yicha himoya qo'yib bo'lmaydi).

### Ikki yo'l

**A. PCS yorliq tokenini yuboradi, Elchi uni buyurtmaning o'z tokeni qilib yozadi** ✅ tavsiya

- Bitta jismoniy yorliq Elchi'ning **butun zanjirida** ishlaydi: qabul
  skani, kuryer skani, pochta skani.
- Omborda qo'shimcha ish yo'q — maqsad aynan shu.
- Narxi: `qr_code_token` noyobligi kerak; migratsiyadan oldin mavjud
  dublikatlar tekshirilishi shart.

**B. Alohida ustunga alias qilib yozish**

- Elchi'ning ichki tokeni tegilmaydi, qabul skani alias orqali topadi.
- Lekin posilkada Elchi tokeni **yo'q** qoladi → keyin kuryer skani
  ishlamaydi → operator Elchi yorlig'ini chop etishi kerak.
- **Ish ko'payadi, kamaymaydi.** Maqsadga qarshi.

**QAROR: A** ✅ — ustiga alias ustuni ham qoldiriladi (audit va teskari
qidiruv uchun), noyoblik qo'riqchisi bilan.

---

## 5. Har skan darhol yoziladimi yoki oxirida birga?

Siz aytgan namuna — PCS'dagi Adosh oqimi (`today-orders/index.tsx`) —
aslida **yig'ib, oxirida bitta "Qabul qilish"** bosadi (satr 1304).
Elchi'ning hozirgi sahifasi ham shunday. Ya'ni "Adoshdagidek" va
"skanerlagani yozilib ketaversin" bir-biriga to'liq mos emas.

Tavsiya: **har skan darhol yoziladi**, chunki:

- siz aytgani aynan shu ("yozilib ketaverishi kerak");
- yig'ib turish brauzer yopilsa **butun sessiyani** yo'q qiladi;
- pochtaga ajratish baribir har buyurtma uchun alohida bajariladi.

**Narxi — buni bilib turishingiz kerak:** darhol yozilsa, xato skanni
**ortga qaytarish qiyin** — buyurtma allaqachon RECEIVED va pochtada.
Shuning uchun "Oxirgisini qaytarish" kerak bo'ladi, u esa
`RECEIVED → CREATED` o'tishini talab qiladi — hozir state machine'da
bunday o'tish **YO'Q** (`RECEIVED → ON_THE_ROAD | WAITING | CANCELLED`).

**QAROR: qo'riqlangan qaytarish** ✅ — "Oxirgisini qaytarish".
Qo'riqchilar (hammasi bajarilishi shart):

```
hamkor posilkasi (partner_shipment_ref bor)
  AND status hamon RECEIVED
  AND courier_id IS NULL          ← kuryerga berilgan bo'lsa qaytarilmaydi
  AND shu skan sessiyasi ichida
```

State machine'ga `RECEIVED → CREATED` qo'shiladi, LEKIN faqat shu yo'l
uchun — umumiy ruxsat qilinmaydi, aks holda har joyda ortga qaytarish
ochilib ketardi. Pochtadan chiqarish ham shu amalda bajariladi
(`post_id = NULL`), aks holda pochta soni buzilardi.

---

## 6. O'zgaradigan joylar

### Elchi-Backend

| # | Fayl | O'zgarish |
|---|------|-----------|
| 1 | `integration-service.service.ts` → `createPartnerShipment` | `status: CREATED`, `qr_code_token: dto.label_token`, kutilmoqda belgisi |
| 2 | `partner-gateway.controller.ts` + swagger DTO | `label_token` qabul qilish |
| 2b | `partner-gateway.controller.ts` | `PATCH /partner/shipments/:id/label` — backfill uchun. **Nega alohida endpoint:** `POST /shipments` idempotent deb hujjatlashtirilgan; uni "mavjud bo'lsa o'zgartiradi" qilish kontraktni loyqalashtiradi va keyin kimdir buni bilmay qayta jo'natib tokenni almashtirib yuborardi |
| 3 | `partner-shipment-ref.entity.ts` | `external_label_token` (noyob) |
| 4 | yangi migratsiya | ustun + noyob indeks + **dublikat oldindan tekshiruvi** |
| 5 | `order-lifecycle.service.ts` | `receivePartnerOrderByScan` — CREATED→RECEIVED + pochtaga ajratish (mavjud kod qayta ishlatiladi, nusxalanmaydi) |
| 6 | `order-service.controller.ts` | `order.receive_partner_scan` |
| 7 | `order-gateway.controller.ts` | `POST orders/partner-scan` |
| 8 | `order-status.machine.ts` | `RECEIVED → CREATED` (qaytarish uchun, qo'riqlangan) |

### Elchi-Frontend

| # | Fayl | O'zgarish |
|---|------|-----------|
| 9 | `pages/incoming-orders/index.tsx` | qayta yozish: hamkor tanlash + darhol yozuv + pochta nomi bilan ro'yxat |
| 10 | yangi: "Kutilayotgan posilkalar" | soni + yoshi, faqat o'qish uchun |
| 11 | tekshirish | CREATED hamkor posilkasi harakat qilinadigan hech bir ro'yxatda chiqmasligi — **taxmin qilmay, tekshirib** |

### PCS

| # | Fayl | O'zgarish |
|---|------|-----------|
| 12 | `elchi-shipment.service.ts` | `label_token` yuborish (buyurtmaning `qr_code_token`i) |
| 13 | — | status uchun **hech narsa** (mapper allaqachon `created`ni biladi) |
| 14 | `elchi-admin.service.ts` | ixtiyoriy: "N kundan kutilmoqda" ogohlantirishi |

---

## 7. Xavflar

| # | Xavf | Nima qilamiz |
|---|------|--------------|
| 1 | **Yo'ldagi posilkalar.** Deploy vaqtida Elchi'da allaqachon NEW holatda, Elchi tokeni bilan turgan posilkalar bor. Ularning yorlig'i BeePost tokeni — mos kelmaydi | ✅ **QAROR: backfill.** Migratsiya `partner_shipment_ref` join bilan topadi va PCS tokenini yozadi → bitta oqim, ikkilanish yo'q. ⚠️ PCS tokenini migratsiya BILMAYDI (boshqa bazada) — shu bois backfill PCS'dan boshlanadi: PCS har bir yo'ldagi posilka uchun `label_token`ni qayta yuboradi (idempotent yo'l token yangilaydi) |
| 2 | **Noyoblik migratsiyasi yiqilishi mumkin** — mavjud `qr_code_token` dublikatlari bo'lsa (masalan `CANCEL-${Date.now()}` bir ms ichida ikki marta) | Haqiqiy ma'lumotda **oldindan** sanash; dublikat bo'lsa avval tozalash |
| 3 | **`whitelist: true` `label_token`ni jimgina o'chiradi** — DTO'ga yozilmasa. Natija: skan hech qachon mos kelmaydi va xato **skaner buzuq** kabi ko'rinadi | DTO + shu maydon uchun alohida test (bu tuzoqqa avval tushganmiz) |
| 4 | `POST /partner/shipments` `(partner, external_order_id)` bo'yicha idempotent — qayta jo'natishda **eski yozuv** qaytadi | Idempotent yo'lda token yangilanishini alohida ishlash |
| 5 | **Skanerlanmagan posilka abadiy CREATED'da qoladi** — hozir buni hech kim sezmaydi | "Kutilayotgan" hisoblagichi + yosh ("3 kundan ortiq: 4 ta") |

---

## 8. Qamrov chegarasi

- Faqat `source='external'` hamkor posilkalari. Elchi'ning **o'z**
  marketlari buyurtmalari avvalgidek NEW'ga tushadi — ular uchun
  qabul oqimi **o'zgarmaydi**.
- Ulanishlar, xavfsizlik, webhook, imzo, IP ro'yxati — **tegilmaydi**
  (siz shunday aytdingiz).
- Har hamkor uchun sozlama: `require_scan_on_arrival` (BeePost = true).
  Keyinchalik skan talab qilmaydigan hamkor kerak bo'lsa, migratsiya
  qayta yozilmasin.

---

## 9. Ketma-ketlik

| Bosqich | Ish | Natija |
|---------|-----|--------|
| 0 | Haqiqiy ma'lumot tekshiruvi: `qr_code_token` dublikatlari, NEW'dagi hamkor posilkalari soni | 1 va 2-xavf bo'yicha qaror |
| 1 | Backend: token + CREATED + skan endpointi + testlar | API tayyor |
| 2 | Frontend: skanerlash sessiyasi + kutilayotganlar | Ekran tayyor |
| 3 | PCS: `label_token` yuborish | Zanjir yopiladi |
| 4 | Uchdan-uchga sinov: jo'nat → ko'rinmasin → skanerla → pochtada | Tasdiq |

---

## 10. Qabul qilingan qarorlar (2026-09-12)

| # | Savol | Qaror |
|---|-------|-------|
| 1 | Token yo'li | **A** — PCS tokeni Elchi tokeni bo'ladi |
| 2 | Xato skanni qaytarish | **Bor** — qo'riqlangan `RECEIVED → CREATED` |
| 3 | Yo'ldagi eski posilkalar | **Backfill** — PCS tokeni yoziladi |

Ishga ruxsat: **kutilmoqda.**
