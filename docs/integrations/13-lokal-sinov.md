# 13 — BeePost'ni LOKALDA ishga tushirib Elchi bilan sinash

> Holat: **ISHLAYDI** — 2026-09-15 da o'tkazilgan va tasdiqlangan.

## Nima uchun shunday topologiya

BeePost (PCS) — **ishlab turgan real tizim**, unga tegmaymiz. Elchi esa
produksiyada ishlatilishi mumkin. Shuning uchun:

```
   PCS (LOKAL, localhost:8080)  ──HTTPS──▶  Elchi (PRODUKSIYA)
        ▲                                   api.elchipochta.uz
        │
   lokal Postgres
   post_control_system
```

⚠️ **Elchi produksiya bazasiga yozadi.** Sinov posilkalari haqiqiy buyurtma
yaratadi. Shu bois ular `pcs-smoke-<vaqt>` prefiksi bilan belgilanadi,
summasi 10 000 so'm qo'yiladi va **darhol bekor qilinadi**. Terminal holat —
`cancelled`, ya'ni oqimga aralashmaydi.

---

## 1. Bir martalik tayyorgarlik

### Bog'liqliklar

```bash
ss -ltn | grep 5432        # Postgres ishlashi shart
```

RabbitMQ **kerak emas** — PCS monolit, navbat ishlatmaydi. (U faqat Elchi'ning
o'zini lokalda ko'targanda kerak, lekin biz Elchi produksiyasini ishlatamiz.)

### Migratsiyalar

```bash
cd server
npm run migration:run
```

Oxirgisi `ElchiRealMoneyFields1749600004000` bo'lishi kerak — u hisob-kitob
paneli uchun haqiqiy pul ustunlarini qo'shadi (audit M2).

### Sozlama tekshiruvi

Lokal bazada `elchi_config` to'ldirilgan bo'lishi kerak:

```sql
SELECT api_base_url, (api_key IS NOT NULL) AS kalit,
       elchi_market_id, elchi_courier_user_id, is_active, webhook_enabled
FROM elchi_config;
```

Kutilgan:

| Maydon | Qiymat |
|---|---|
| `api_base_url` | `https://api.elchipochta.uz` |
| `api_key` | mavjud |
| `elchi_market_id` | mavjud (yo'q bo'lsa UI'dan «Market akkaunti») |
| `elchi_courier_user_id` | mavjud (vakil-kuryer) |

⚠️ **Manzilda `/api` prefiksi YO'Q.** `https://api.elchipochta.uz/partner/...`
to'g'ri, `.../api/partner/...` esa Swagger UI'ga tushadi va Basic auth bilan
401 beradi. Bu eng oson qilinadigan xato.

---

## 2. Ishga tushirish

```bash
cd server && npm run build && node dist/main.js     # :8080
cd client && npm run dev                            # :5173
```

Tekshirish: `http://localhost:8080` loglarida
`🚀 Server running on http://localhost:8080`.

---

## 3. Sinov — bitta buyruq

```bash
bash server/scripts/local/elchi-smoke.sh            # faqat o'qish
bash server/scripts/local/elchi-smoke.sh --create   # + posilka yaratish
```

Skript kalitni **lokal bazadan o'zi oladi** — qo'lda kiritish shart emas.

### Nimani tekshiradi

| Bosqich | Tekshiruv |
|---|---|
| 1 | Autentifikatsiya: kalitsiz 401, yaroqsiz 401, haqiqiy 200 |
| 2 | Geo: 14 viloyat, 181 tuman (SOATO kodlari bilan) |
| 3 | Tarif (`elchi_market_id` majburiy) |
| 4 | Xato ishlanishi: 404, bo'sh tana 400, begona maydon 400 |
| 5 | **Pul maydonlari**: `collected_from_customer`, `elchi_fee`, `market_amount` |
| 6 | Posilka yaratish (faqat `--create` bilan) |
| 7 | Idempotentlik, holat o'qish, bekor qilish, takroriy bekor |

Kutilgan natija: **18 o'tdi, 0 yiqildi**.

---

## 4. Webhook — nima ishlaydi, nima yo'q

| Yo'nalish | Holat |
|---|---|
| PCS → Elchi (so'rov) | ✅ ishlaydi |
| Elchi → PCS (webhook push) | ❌ **lokalda ishlamaydi** |
| PCS → Elchi (solishtiruv pull) | ✅ ishlaydi, 15 daqiqada bir |

Elchi lokal mashinaga murojaat qila olmaydi — `localhost` unga ko'rinmaydi.
Shuning uchun **status ma'lumoti solishtiruv CRON'i orqali keladi**:
`elchi-reconcile.service.ts` har 15 daqiqada ochiq posilkalarni Elchi'dan
so'raydi va `applyStatusUpdate` bilan qo'llaydi — **webhook bilan aynan bir
xil yo'l**. Ya'ni:

- sotildi / bekor / qaytdi — ✅ keladi (kechikish bilan)
- **rollback** (Elchi sotuvni qaytardi) — ✅ keladi
- pul maydonlari — ✅ keladi

Qo'lda tezlashtirish: PCS UI → Integratsiyalar → Elchi → «Solishtirish»
tugmasi, yoki `POST /api/v1/elchi/reconcile`.

### Webhook'ni ham sinash kerak bo'lsa

Tunnel kerak (`cloudflared` yoki `ngrok`):

```bash
cloudflared tunnel --url http://localhost:8080
# chiqqan manzilni Elchi admin panelida hamkor webhook_url iga qo'yish
# + sekretni IKKI tomonda bir xil qilish
```

⚠️ Bu **produksiya Elchi sozlamasini o'zgartiradi** — BeePost hamkoriga
tegmaslik uchun alohida sinov hamkori ishlatilsin.

---

## 5. Tozalash

Sinov posilkalari `pcs-smoke-` prefiksi bilan topiladi:

```sql
SELECT r.external_order_id, r.order_id, o.status
FROM integration_schema.partner_shipment_refs r
LEFT JOIN order_schema.orders o ON o.id = r.order_id::bigint
WHERE r.external_order_id LIKE 'pcs-smoke-%';
```

Ular `cancelled` holatda bo'lishi kerak. Bo'lmasa — skript bekor qilish
bosqichigacha bormagan, qo'lda bekor qilinadi.

---

## 6. Ma'lum cheklovlar

| Cheklov | Sabab |
|---|---|
| Webhook push ishlamaydi | `localhost` Elchi'ga ko'rinmaydi (tunnel kerak) |
| Sinov buyurtmalari produksiyada qoladi | Elchi produksiyasi ishlatiladi; `cancelled` holatda, zararsiz |
| Elchi'ni lokal ko'tarish qiyin | 7 mikroservis + RabbitMQ; skript bor (`Elchi-Backend/scripts/local/start-test-stack.sh`) lekin RMQ navbat nomlari mos kelmasligi mumkin |

Elchi'ni to'liq lokalda ko'tarish kerak bo'lsa: `npm run build:all`, keyin
`bash scripts/local/start-test-stack.sh`. Bu **to'liq izolyatsiya** beradi
(produksiyaga umuman tegilmaydi), lekin sozlash uzoqroq.
