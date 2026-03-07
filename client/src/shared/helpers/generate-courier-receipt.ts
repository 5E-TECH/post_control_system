import QRCode from "qrcode";

interface CourierReceiptData {
  qrCodeToken: string;
  courierName: string;
  regionName: string;
  courierPhone: string;
  orderCount?: number;
  date?: string | number;
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("998") && cleaned.length === 12) {
    return `+998 (${cleaned.slice(3, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10, 12)}`;
  }
  return phone;
}

function formatDate(timestamp: string | number): string {
  const d = new Date(Number(timestamp) || Date.now());
  return d.toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generateCourierReceipt(data: CourierReceiptData): Promise<void> {
  const qrValue = `post_${data.qrCodeToken}`;
  const qrDataUrl = await QRCode.toDataURL(qrValue, { width: 200, margin: 1 });
  const phone = formatPhone(data.courierPhone);
  const date = data.date ? formatDate(data.date) : formatDate(Date.now());

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pochta cheki - ${data.regionName}</title>
<style>
  @page {
    size: 100mm 60mm landscape;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    width: 100mm;
    height: 60mm;
    margin: 0 auto;
    background: #fff;
    color: #000;
    overflow: hidden;
  }
  .receipt {
    width: 100mm;
    height: 60mm;
    border: 0.5px solid #000;
    padding: 2mm 3mm;
    display: flex;
    flex-direction: column;
  }
  /* Yuqori — BEEPOST + sana */
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1mm;
  }
  .brand {
    font-size: 13pt;
    font-weight: 900;
    letter-spacing: 2px;
  }
  .date {
    font-size: 7.5pt;
    font-weight: bold;
    color: #333;
  }
  .divider {
    border-top: 1px dashed #aaa;
    margin-bottom: 1.5mm;
  }
  /* Kurier ismi — to'liq qator, katta, jirniy */
  .courier-name {
    font-size: 16pt;
    font-weight: 900;
    line-height: 1.15;
    margin-bottom: 1mm;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  /* Telefon — kattaroq */
  .courier-phone {
    font-size: 12pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-bottom: 1.5mm;
  }
  /* Pastki qism — QR chap, viloyat+soni o'ng */
  .bottom {
    flex: 1;
    display: flex;
    gap: 3mm;
    align-items: center;
  }
  .qr-box {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .qr-img {
    width: 26mm;
    height: 26mm;
  }
  .scan-hint {
    font-size: 5pt;
    color: #888;
    text-align: center;
    margin-top: 0.5mm;
  }
  .details {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2mm;
  }
  .detail-row {
    display: flex;
    align-items: baseline;
    gap: 1.5mm;
  }
  .detail-label {
    font-size: 7pt;
    color: #666;
    white-space: nowrap;
  }
  .detail-value {
    font-size: 14pt;
    font-weight: 900;
  }
  .detail-value.count {
    font-size: 15pt;
  }
  @media print {
    body { width: 100mm; height: 60mm; }
    .receipt { border: none; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="top">
      <div class="brand">BEEPOST</div>
      <div class="date">${date}</div>
    </div>
    <div class="divider"></div>
    <div class="courier-name">${data.courierName}</div>
    <div class="courier-phone">${phone}</div>
    <div class="bottom">
      <div class="qr-box">
        <img class="qr-img" src="${qrDataUrl}" alt="QR" />
        <div class="scan-hint">scan &amp; receive</div>
      </div>
      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Viloyat:</span>
          <span class="detail-value">${data.regionName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Buyurtma:</span>
          <span class="detail-value count">${data.orderCount || 0} ta</span>
        </div>
      </div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
