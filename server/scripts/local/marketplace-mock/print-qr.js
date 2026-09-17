'use strict';

/**
 * MOCK POSILKALARI UCHUN BOSIB CHIQARILADIGAN QR VARAQ.
 *
 * Real skaner bilan sinash uchun QR jismonan kerak. Bu skript mock
 * seed'idagi 11 posilkani bitta HTML varaqqa chiqaradi — brauzerda
 * ochib, bosib chiqarasiz va oddiy skaner bilan skanerlaysiz.
 *
 * Har kartada posilka NIMA SINAYOTGANI ham yozilgan — qaysi QR qaysi
 * chekka holatni tekshirishini eslab yurish shart emas.
 *
 *   node server/scripts/local/marketplace-mock/print-qr.js
 *   → server/scripts/local/marketplace-mock/qr-varaq.html
 */
const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');
const { PARCELS } = require('./seed.js');

const money = (n) => Number(n || 0).toLocaleString('ru-RU');

async function main() {
  const cards = [];

  for (const p of PARCELS) {
    // ⚠️ QR ichida AYNAN `qr_token` — skan shuni kutadi. Normalizatsiya
    // serverda bo'ladi, shuning uchun registrni o'zgartirmaymiz.
    const dataUrl = await QRCode.toDataURL(p.qr_token, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    const m = p.money || {};
    const box = p.parcel_count > 1 ? `${p.parcel_index}/${p.parcel_count}` : '';
    const flags = [
      m.prepaid ? 'PREPAID' : null,
      p.status !== 'READY_FOR_PICKUP' ? p.status : null,
      p.where_deliver === 'address' ? 'UYGACHA' : null,
    ].filter(Boolean);

    cards.push(`
      <div class="card">
        <img src="${dataUrl}" alt="${p.qr_token}" />
        <div class="token">${p.qr_token}</div>
        <div class="meta">
          <b>${p.external_parcel_id}</b>${box ? ` · quti ${box}` : ''}
        </div>
        <div class="money">
          olinadi: <b>${money(m.cod_amount)}</b> so'm
        </div>
        ${flags.length ? `<div class="flags">${flags.join(' · ')}</div>` : ''}
        <div class="why">${p._why || ''}</div>
      </div>`);
  }

  const html = `<!doctype html>
<meta charset="utf-8">
<title>Marketplace mock — QR varaq</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .hint { font-size: 12px; color: #555; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .card { border: 1px solid #bbb; border-radius: 6px; padding: 10px;
          text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .card img { width: 180px; height: 180px; }
  .token { font-family: ui-monospace, monospace; font-size: 13px;
           font-weight: 700; margin-top: 4px; }
  .meta { font-size: 12px; margin-top: 2px; }
  .money { font-size: 12px; margin-top: 2px; }
  .flags { font-size: 11px; font-weight: 700; color: #b00; margin-top: 3px; }
  .why { font-size: 10px; color: #666; margin-top: 4px; min-height: 24px; }
  @media print { .hint { display: none; } body { margin: 0; } }
</style>
<h1>Marketplace mock — sinov posilkalari (${PARCELS.length} ta)</h1>
<div class="hint">
  Bosib chiqaring va oddiy skaner bilan skanerlang. Har kartada posilka
  nima sinayotgani yozilgan. VOIDED posilka ataylab rad etilishi kerak.
</div>
<div class="grid">${cards.join('')}</div>`;

  const out = path.join(__dirname, 'qr-varaq.html');
  fs.writeFileSync(out, html);
  console.log(`✅ ${PARCELS.length} ta QR yozildi: ${out}`);

  /**
   * ⚠️ Klientning `public/` iga ham nusxa. Repo ichidagi chuqur yo'lni
   * fayl menejeridan topish noqulay — dev-server ishlab turganda
   * `http://localhost:5173/admin/qr-varaq.html` bilan ochilgani osonroq.
   */
  const pub = path.join(__dirname, '../../../../client/public');
  if (fs.existsSync(pub)) {
    fs.writeFileSync(path.join(pub, 'qr-varaq.html'), html);
    console.log('   Brauzerda: http://localhost:5173/admin/qr-varaq.html');
  } else {
    console.log('   Brauzerda oching va bosib chiqaring.');
  }
}

main().catch((e) => {
  console.error('QR varaq yasalmadi:', e);
  process.exit(1);
});
