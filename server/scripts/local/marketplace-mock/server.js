#!/usr/bin/env node
'use strict';

/**
 * MARKETPLACE MOCK — BeePost kontraktining MARKETPLACE tomoni.
 *
 * Ikki vazifasi bor:
 *
 *  1. BeePost tomonini ULARNI KUTMASDAN yozish va sinash imkonini beradi.
 *  2. KONTRAKT TEKSHIRUVCHISI — shunchaki 200 qaytarmaydi, balki
 *     `MARKETPLACE_PARTNER_API.md` dagi har bir MUST qoidasini tekshiradi va
 *     buzilganini `/_mock/report` da ko'rsatadi.
 *
 * Eng qimmatli qismi — DAFTAR SOLISHTIRUVI: mock balansni MUSTAQIL hisoblaydi
 * va har hodisadagi `ledger.balance_after` bilan solishtiradi. Ikki daftar
 * ajralsa, u darhol shu yerda ko'rinadi — prod'da emas.
 *
 * Bog'liqlik YO'Q (faqat Node standart kutubxonasi) — marketplace dasturchilari
 * uni o'z tizimlari uchun boshlang'ich namuna sifatida ham ishlatishi mumkin.
 *
 * Ishga tushirish:
 *   node server/scripts/local/marketplace-mock/server.js
 *   MP_CHAOS=500 node .../server.js      # xato rejimi (circuit breaker sinovi)
 */

const http = require('node:http');
const crypto = require('node:crypto');
const { SELLERS, PARCELS } = require('./seed');

// ─────────────────────────── SOZLAMALAR ───────────────────────────────────

const CFG = {
  port: Number(process.env.MP_PORT || 4010),
  apiKey: process.env.MP_API_KEY || 'mock-marketplace-key',
  secret: process.env.MP_SECRET || 'mock-secret-v1',
  // Bo'sh bo'lmasa — ikki kalitli aylantirish sinovi yoqiladi.
  secretPrev: process.env.MP_SECRET_PREV || '',
  toleranceSec: Number(process.env.MP_TOLERANCE || 300),
  // off | slow | 500 | down — `parcels/lookup` ga qo'llanadi (skan oqimi).
  chaos: process.env.MP_CHAOS || 'off',
  // Kelishilgan tarif — mock buni MUSTAQIL tekshiradi.
  tariffCenter: Number(process.env.MP_TARIFF_CENTER || 50000),
  tariffHome: Number(process.env.MP_TARIFF_HOME || 70000),
};

// ─────────────────────────── HOLAT ────────────────────────────────────────

const state = {
  /** external_parcel_id -> {status, last_applied_seq, money, updated_at} */
  parcels: new Map(),
  /** Ko'rilgan event_id lar — dedup uchun (MUST #7). */
  seenEvents: new Set(),
  /** batch_id -> javob (accept idempotentligi, MUST #6). */
  batches: new Map(),
  /** Daftar yozuvlari — mock MUSTAQIL hisoblaydi. */
  ledger: [],
  balance: 0,
  /** seller_id -> summa */
  bySeller: new Map(),
  /** Kontrakt buzilishlari. */
  issues: [],
  /** Statistika. */
  counters: { lookup: 0, accept: 0, events: 0, duplicates: 0, stale: 0, unsigned: 0 },
};

function seed() {
  state.parcels.clear();
  for (const p of PARCELS) {
    state.parcels.set(p.external_parcel_id, {
      def: p,
      status: p.status,
      last_applied_seq: 0,
      money: null,
      updated_at: Date.now(),
      accepted_batch: null,
    });
  }
}
seed();

function issue(severity, code, message, extra) {
  const row = { at: new Date().toISOString(), severity, code, message, ...(extra || {}) };
  state.issues.push(row);
  const tag = severity === 'error' ? '❌ KONTRAKT BUZILDI' : '⚠️  OGOHLANTIRISH';
  console.log(`${tag}  [${code}] ${message}`);
  return row;
}

// ─────────────────────────── IMZO ─────────────────────────────────────────

/**
 * `X-BeePost-Signature: t=<unix>,v1=<hex>[,v2=<hex>]`
 * base = `${t}.${rawBody}` — XOM tanadan, qayta stringify QILINMAYDI.
 */
function verifySignature(header, rawBody) {
  if (!header) return { ok: false, why: 'imzo sarlavhasi yo\'q' };

  const parts = {};
  for (const kv of String(header).split(',')) {
    const i = kv.indexOf('=');
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }

  const t = Number(parts.t);
  if (!Number.isFinite(t)) return { ok: false, why: '`t` yo\'q yoki son emas' };

  const drift = Math.abs(Date.now() / 1000 - t);
  if (drift > CFG.toleranceSec) {
    return { ok: false, why: `vaqt oynasidan tashqarida (${Math.round(drift)}s > ${CFG.toleranceSec}s)` };
  }

  const base = `${t}.${rawBody}`;

  // ⚠️ HAR SEKRET HAR MAYDONGA qarshi tekshiriladi (`v1` VA `v2`) — pozitsiya
  // bo'yicha EMAS. Aks holda kalit aylantirish ishlamaydi: jo'natuvchi yangi
  // kalitni `v1` ga qo'yadi, qabul qiluvchi esa hali faqat eskisini biladi.
  // Aylantirishning maqsadi tomonlar bir vaqtda almashtirmasligi edi.
  const secrets = [CFG.secret, CFG.secretPrev].filter(Boolean);
  for (const key of secrets) {
    const want = crypto.createHmac('sha256', key).update(base).digest('hex');
    const b = Buffer.from(want, 'hex');
    for (const field of ['v1', 'v2']) {
      const given = parts[field];
      if (!given) continue;
      let a;
      try { a = Buffer.from(given, 'hex'); } catch { continue; }
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return { ok: true, matched: field };
      }
    }
  }
  return { ok: false, why: 'imzo mos kelmadi' };
}

// ─────────────────────────── YORDAMCHILAR ─────────────────────────────────

function send(res, code, body, extraHeaders) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...(extraHeaders || {}),
  });
  res.end(payload);
}

function fail(res, code, errCode, message, details) {
  send(res, code, { error: { code: errCode, message, ...(details ? { details } : {}) } });
}

function normToken(t) {
  return String(t == null ? '' : t).trim().toLowerCase();
}

function findByToken(token) {
  const want = normToken(token);
  for (const st of state.parcels.values()) {
    if (normToken(st.def.qr_token) === want) return st;
  }
  return null;
}

function publicParcel(st) {
  const d = st.def;
  return {
    parcel: {
      external_parcel_id: d.external_parcel_id,
      external_order_id: d.external_order_id,
      qr_token: d.qr_token,
      parcel_index: d.parcel_index,
      parcel_count: d.parcel_count,
      status: st.status,
      created_at: 1789400000000,
    },
    seller: (() => {
      const s = SELLERS.find((x) => x.seller_id === d.seller_id);
      return {
        seller_id: d.seller_id,
        seller_name: s ? s.name : null,
        seller_phone: s ? s.phone : null,
      };
    })(),
    customer: d.customer,
    money: d.money,
    items: d.items,
    where_deliver: d.where_deliver,
  };
}

// ─────────────────────────── DAFTAR ───────────────────────────────────────

/**
 * Hodisadagi pulni MUSTAQIL qo'llaydi va `balance_after` ni solishtiradi.
 * Ikki daftar ajralsa — aynan shu yerda ushlanadi.
 */
function applyMoney(ev) {
  const m = ev.money || {};
  const seller = (ev.parcel && ev.parcel.seller_id) || null;

  let delta = null;
  let type = null;

  if (ev.event_type === 'settlement.paid') {
    delta = -Math.trunc(Number((ev.settlement && ev.settlement.amount) || 0));
    type = 'settlement';
  } else if (Object.prototype.hasOwnProperty.call(m, 'net_to_marketplace')) {
    delta = Math.trunc(Number(m.net_to_marketplace));
    type = ev.event_type;
  }

  if (delta === null || !Number.isFinite(delta)) return;

  // MUST: manfiy summa RAD ETILMAYDI (prepaid holati).
  state.balance += delta;
  if (seller) state.bySeller.set(seller, (state.bySeller.get(seller) || 0) + delta);
  state.ledger.push({
    seq: ev.seq, event_type: ev.event_type, seller_id: seller,
    external_parcel_id: ev.parcel && ev.parcel.external_parcel_id,
    amount: delta, balance_after: state.balance, at: Date.now(),
  });

  // ── SOLISHTIRUV: bizning hisob vs ularning `balance_after` ──
  const reported = ev.ledger && ev.ledger.balance_after;
  if (reported != null) {
    const r = Math.trunc(Number(reported));
    if (r !== state.balance) {
      issue('error', 'LEDGER_DRIFT',
        `Daftar ajraldi: mock ${state.balance}, BeePost ${r} (farq ${r - state.balance})`,
        { seq: ev.seq, event_type: ev.event_type, parcel: ev.parcel && ev.parcel.external_parcel_id });
    }
  } else {
    issue('warn', 'NO_BALANCE_AFTER',
      '`ledger.balance_after` yuborilmadi — o\'z-o\'zini tuzatish mexanizmi ishlamaydi',
      { seq: ev.seq, event_type: ev.event_type });
  }

  // ── Tarif tekshiruvi ──
  if (m.beepost_fee != null && m.beepost_fee_basis) {
    const want = m.beepost_fee_basis === 'home' ? CFG.tariffHome : CFG.tariffCenter;
    const got = Math.trunc(Number(m.beepost_fee));
    if (got !== 0 && got !== want) {
      issue('error', 'TARIFF_MISMATCH',
        `Tarif kelishuvga mos emas: ${m.beepost_fee_basis} uchun ${want} kutilgan, ${got} keldi`,
        { seq: ev.seq, parcel: ev.parcel && ev.parcel.external_parcel_id });
    }
  }

  // ── Arifmetika tekshiruvi ──
  if (m.collected_from_customer != null && m.beepost_fee != null && m.net_to_marketplace != null) {
    const expect = Math.trunc(Number(m.collected_from_customer))
      - Math.trunc(Number(m.beepost_fee))
      - Math.trunc(Number(m.extra_cost || 0));
    if (expect !== Math.trunc(Number(m.net_to_marketplace))) {
      issue('error', 'MONEY_FORMULA',
        `net_to_marketplace formulasi buzilgan: ${expect} kutilgan, ${m.net_to_marketplace} keldi`,
        { seq: ev.seq, parcel: ev.parcel && ev.parcel.external_parcel_id });
    }
  }
}

// ─────────────────────────── MARSHRUTLAR ──────────────────────────────────

const TERMINAL = new Set(['DELIVERED', 'CANCELLED', 'RETURNED', 'REJECTED_BY_BEEPOST', 'VOIDED']);

function handleEvents(body, res) {
  const ev = body;
  state.counters.events++;

  if (!ev || !ev.event_id || !ev.event_type) {
    return fail(res, 400, 'BAD_EVENT', '`event_id` va `event_type` majburiy');
  }

  // MUST #1 — event_id bo'yicha dedup.
  if (state.seenEvents.has(ev.event_id)) {
    state.counters.duplicates++;
    console.log(`   ↩︎  dublikat: ${ev.event_type} (${ev.event_id.slice(0, 8)})`);
    return send(res, 200, { ok: true, receipt_id: `mock-${ev.event_id}`, applied: false, reason: 'DUPLICATE' });
  }

  const pid = ev.parcel && ev.parcel.external_parcel_id;
  const st = pid ? state.parcels.get(pid) : null;

  if (pid && !st) {
    issue('warn', 'UNKNOWN_PARCEL', `Noma'lum posilka: ${pid}`, { seq: ev.seq });
    return fail(res, 404, 'PARCEL_NOT_FOUND', `Posilka topilmadi: ${pid}`);
  }

  // MUST #2 — seq bo'yicha tartib.
  if (st && ev.seq != null) {
    const seq = Number(ev.seq);
    if (seq <= st.last_applied_seq) {
      state.counters.stale++;
      console.log(`   ⏮  eskirgan seq ${seq} <= ${st.last_applied_seq} (${pid})`);
      return send(res, 200, {
        ok: true, applied: false, reason: 'STALE_SEQ', current_seq: st.last_applied_seq,
      });
    }
    if (seq > st.last_applied_seq + 1 && st.last_applied_seq > 0) {
      issue('warn', 'SEQ_GAP',
        `seq uzilishi: ${st.last_applied_seq} → ${seq} (${seq - st.last_applied_seq - 1} ta hodisa yo'qolgan)`,
        { parcel: pid });
    }
  }

  state.seenEvents.add(ev.event_id);

  // Status qo'llash.
  if (st) {
    const wasTerminal = TERMINAL.has(st.status);
    if (ev.status && ev.status.to) {
      if (wasTerminal && ev.event_type !== 'parcel.rolled_back') {
        issue('warn', 'TERMINAL_OVERWRITE',
          `Terminal holat ustiga yozildi: ${st.status} → ${ev.status.to}`, { parcel: pid, seq: ev.seq });
      }
      st.status = ev.status.to;
    }
    if (ev.seq != null) st.last_applied_seq = Number(ev.seq);
    if (ev.money) st.money = ev.money;
    st.updated_at = Date.now();
  }

  applyMoney(ev);

  const label = pid ? `${ev.event_type} ${pid}` : ev.event_type;
  const net = ev.money && ev.money.net_to_marketplace;
  console.log(`   ✓  seq=${ev.seq ?? '-'}  ${label}${net != null ? `  net=${net}` : ''}  balans=${state.balance}`);

  return send(res, 200, { ok: true, receipt_id: `mock-${ev.event_id}`, applied: true });
}

function handleAccept(body, res) {
  state.counters.accept++;
  const batchId = body && body.batch_id;
  if (!batchId) return fail(res, 400, 'BAD_REQUEST', '`batch_id` majburiy');

  // MUST #3 — batch_id bo'yicha idempotentlik.
  if (state.batches.has(batchId)) {
    console.log(`   ↩︎  accept dublikat: batch ${batchId}`);
    return send(res, 200, state.batches.get(batchId));
  }

  const accepted = [];
  const rejected = [];
  const errors = [];

  for (const it of body.items || []) {
    const st = state.parcels.get(it.external_parcel_id);
    if (!st) { errors.push({ external_parcel_id: it.external_parcel_id, code: 'NOT_FOUND' }); continue; }
    if (st.accepted_batch) {
      errors.push({ external_parcel_id: it.external_parcel_id, code: 'ALREADY_ACCEPTED' });
      continue;
    }
    if (st.status === 'VOIDED') {
      // PCS buni qabul qilmasligi kerak edi — kontrakt buzilishi.
      issue('error', 'ACCEPTED_VOIDED',
        `BeePost bekor qilingan posilkani qabul qildi: ${it.external_parcel_id}`);
      errors.push({ external_parcel_id: it.external_parcel_id, code: 'VOIDED' });
      continue;
    }
    st.status = 'ACCEPTED_BY_BEEPOST';
    st.accepted_batch = batchId;
    st.updated_at = Date.now();
    accepted.push(it.external_parcel_id);
  }

  for (const it of body.rejected || []) {
    const st = state.parcels.get(it.external_parcel_id);
    if (st) { st.status = 'REJECTED_BY_BEEPOST'; st.updated_at = Date.now(); }
    rejected.push(it.external_parcel_id);
  }

  // Ko'p qutili buyurtma tekshiruvi (O1): bir buyurtmaning barcha qutisi
  // qabul qilinganmi?
  const byOrder = new Map();
  for (const id of accepted) {
    const d = state.parcels.get(id).def;
    byOrder.set(d.external_order_id, (byOrder.get(d.external_order_id) || 0) + 1);
  }
  for (const [orderId, cnt] of byOrder) {
    const total = PARCELS.filter((p) => p.external_order_id === orderId).length;
    if (total > 1 && cnt < total) {
      issue('warn', 'PARTIAL_MULTIBOX',
        `Ko'p qutili buyurtma chala qabul qilindi: ${orderId} — ${cnt}/${total}`);
    }
  }

  const out = { accepted, rejected, errors };
  state.batches.set(batchId, out);
  console.log(`   ✓  accept: ${accepted.length} qabul, ${rejected.length} rad, ${errors.length} xato`);
  return send(res, 200, out);
}

// ─────────────────────────── SERVER ───────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${CFG.port}`);
  const path = url.pathname;

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const started = Date.now();

    // ── Mock boshqaruvi (kontraktdan tashqari) ──
    if (path === '/_mock/report') {
      return send(res, 200, {
        balance: state.balance,
        by_seller: Object.fromEntries(state.bySeller),
        counters: state.counters,
        issues: state.issues,
        parcels: [...state.parcels.values()].map((s) => ({
          id: s.def.external_parcel_id, status: s.status,
          last_applied_seq: s.last_applied_seq, why: s.def._why,
        })),
        verdict: state.issues.filter((i) => i.severity === 'error').length === 0
          ? 'KONTRAKT BUZILMADI ✅'
          : `❌ ${state.issues.filter((i) => i.severity === 'error').length} ta buzilish`,
      });
    }
    if (path === '/_mock/reset') {
      seed();
      state.seenEvents.clear(); state.batches.clear();
      state.ledger.length = 0; state.balance = 0; state.bySeller.clear();
      state.issues.length = 0;
      for (const k of Object.keys(state.counters)) state.counters[k] = 0;
      console.log('\n🔄 mock tozalandi\n');
      return send(res, 200, { ok: true });
    }

    // ── Auth: kalit hamma yerda ──
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== CFG.apiKey) {
      state.counters.unsigned++;
      console.log(`   ⛔ ${req.method} ${path} — API kalit noto'g'ri`);
      return fail(res, 401, 'BAD_API_KEY', 'X-Api-Key noto\'g\'ri');
    }

    // ── Imzo: `ping` dan tashqari HAMMA yozuv so'rovida ──
    const needsSignature = path !== '/bp/v1/ping' && req.method === 'POST';
    if (needsSignature) {
      const v = verifySignature(req.headers['x-beepost-signature'], rawBody);
      if (!v.ok) {
        state.counters.unsigned++;
        console.log(`   ⛔ ${req.method} ${path} — imzo RAD ETILDI: ${v.why}`);
        return fail(res, 401, 'BAD_SIGNATURE', `Imzo rad etildi: ${v.why}`);
      }
      if (v.matched === 'v2') console.log('   🔑 eski kalit (v2) bilan qabul qilindi');
    }

    let body = null;
    if (rawBody) {
      try { body = JSON.parse(rawBody); }
      catch { return fail(res, 400, 'BAD_JSON', 'JSON parse qilinmadi'); }
    }

    console.log(`→  ${req.method} ${path}`);

    // ── 1. ping ──
    if (path === '/bp/v1/ping' && req.method === 'GET') {
      return send(res, 200, { ok: true, version: '1.0.0-mock', server_time: Math.floor(Date.now() / 1000) });
    }

    // ── 2. lookup (chaos shu yerga qo'llanadi) ──
    if (path === '/bp/v1/parcels/lookup' && req.method === 'POST') {
      state.counters.lookup++;
      if (CFG.chaos === 'down') { res.destroy(); return; }
      if (CFG.chaos === '500') {
        console.log('   💥 chaos: 500');
        return fail(res, 500, 'CHAOS', 'Mock ataylab xato qaytardi');
      }
      const respond = () => {
        const st = findByToken(body && body.qr_token);
        if (!st) {
          console.log(`   ✗  topilmadi: ${body && body.qr_token}`);
          return fail(res, 404, 'PARCEL_NOT_FOUND', 'Posilka topilmadi', { qr_token: body && body.qr_token });
        }
        console.log(`   ✓  ${st.def.external_parcel_id} (${st.status}) — ${st.def._why}`);
        return send(res, 200, publicParcel(st));
      };
      if (CFG.chaos === 'slow') { console.log('   🐢 chaos: 12s kechikish'); return setTimeout(respond, 12000); }
      return respond();
    }

    // ── 3. accept ──
    if (path === '/bp/v1/parcels/accept' && req.method === 'POST') return handleAccept(body, res);

    // ── 4. events ──
    if (path === '/bp/v1/events' && req.method === 'POST') return handleEvents(body, res);

    // ── 5. status (solishtiruv) ──
    if (path === '/bp/v1/parcels/status' && req.method === 'GET') {
      const ids = url.searchParams.get('ids');
      const since = Number(url.searchParams.get('updated_since') || 0);
      let list = [...state.parcels.values()];
      if (ids) {
        const want = new Set(ids.split(',').map((x) => x.trim()));
        list = list.filter((s) => want.has(s.def.external_parcel_id));
      } else if (since) {
        list = list.filter((s) => s.updated_at >= since);
      }
      return send(res, 200, {
        items: list.map((s) => ({
          external_parcel_id: s.def.external_parcel_id,
          status: s.status,
          status_at: s.updated_at,
          last_applied_seq: s.last_applied_seq,
          money: s.money ? {
            collected_from_customer: s.money.collected_from_customer,
            net_to_marketplace: s.money.net_to_marketplace,
          } : null,
        })),
        next_cursor: null,
      });
    }

    // ── 6. sellers ──
    if (path === '/bp/v1/sellers' && req.method === 'GET') {
      return send(res, 200, {
        items: SELLERS.map((s) => ({ ...s, updated_at: 1789400000000 })),
        next_cursor: null,
      });
    }

    // ── 7. ledger/balance ──
    if (path === '/bp/v1/ledger/balance' && req.method === 'GET') {
      const sellerId = url.searchParams.get('seller_id');
      if (sellerId) {
        return send(res, 200, {
          currency: 'UZS', as_of: Date.now(),
          total_receivable: state.bySeller.get(sellerId) || 0,
          sellers: [{ seller_id: sellerId, receivable: state.bySeller.get(sellerId) || 0 }],
        });
      }
      return send(res, 200, {
        currency: 'UZS', as_of: Date.now(), total_receivable: state.balance,
        sellers: [...state.bySeller].map(([id, v]) => ({ seller_id: id, receivable: v })),
      });
    }

    console.log(`   ✗  noma'lum yo'l (${Date.now() - started}ms)`);
    return fail(res, 404, 'NOT_FOUND', `Noma'lum yo'l: ${req.method} ${path}`);
  });
});

server.listen(CFG.port, () => {
  console.log('');
  console.log('╭──────────────────────────────────────────────────────────╮');
  console.log('│  MARKETPLACE MOCK — BeePost kontrakti (marketplace tomoni)│');
  console.log('╰──────────────────────────────────────────────────────────╯');
  console.log(`   manzil      http://localhost:${CFG.port}`);
  console.log(`   API kalit   ${CFG.apiKey}`);
  console.log(`   sekret      ${CFG.secret}${CFG.secretPrev ? `  (eski: ${CFG.secretPrev})` : ''}`);
  console.log(`   tarif       markaz ${CFG.tariffCenter} / uy ${CFG.tariffHome}`);
  console.log(`   chaos       ${CFG.chaos}`);
  console.log(`   posilkalar  ${PARCELS.length} ta · sotuvchilar ${SELLERS.length} ta`);
  console.log('');
  console.log('   Hisobot:    curl -s -H "x-api-key: ' + CFG.apiKey + '" localhost:' + CFG.port + '/_mock/report | jq');
  console.log('   Tozalash:   curl -s -H "x-api-key: ' + CFG.apiKey + '" localhost:' + CFG.port + '/_mock/reset');
  console.log('');
});
