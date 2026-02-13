import { BadRequestException, Injectable } from '@nestjs/common';
import { catchError } from 'src/infrastructure/lib/response';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { PrintOrder } from 'src/common/utils/types/order.interface';
import mqtt from 'mqtt'; // ✅ kerak
import { Where_deliver } from 'src/common/enums';
import * as QRCode from 'qrcode';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

@Injectable()
export class PrinterService {
  private readonly queue: PrintOrder[] = [];
  private isPrinting = false;
  private client; // ✅ added

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,
  ) {}

  onModuleInit() {
    // ✅ MQTT clientni faqat 1 marta yaratamiz (har orderda emas)
    this.client = mqtt.connect('mqtt://13.234.20.96:1883', {
      username: 'shodiyor',
      password: 'root',
      reconnectPeriod: 2000,
      connectTimeout: 5000,
    });
    this.client.on('connect', () => {
    });
    this.client.on('error', (err) => {
      console.error('❌ MQTT xato:', err.message);
    });
  }

  async printMultiple(ordersInfoDto: CreatePrinterDto) {
    try {
      const { orderIds } = ordersInfoDto;
      if (!orderIds || orderIds.length === 0) {
        throw new BadRequestException('⚠️ No orders provided');
      }

      const formatPhoneNumber = (phone: string): string => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('998') && cleaned.length === 12) {
          const code = cleaned.slice(3, 5);
          const part1 = cleaned.slice(5, 8);
          const part2 = cleaned.slice(8, 10);
          const part3 = cleaned.slice(10, 12);
          return `+998 (${code}) ${part1}-${part2}-${part3}`;
        }
        return phone;
      };

      const formatCurrency = (amount: number | string): string => {
        const num = Number(amount) || 0;
        return num.toLocaleString('en-US') + " so'm";
      };

      const formatDate = (date: number | string): string => {
        const createdDate = new Date(Number(date) || Date.now());
        return createdDate.toLocaleDateString('uz-UZ');
      };

      const formatRegion = (regionName?: string): string => {
        if (!regionName) return '';
        if (regionName.trim().startsWith('Qoraqal')) {
          return regionName.split(' ')[0];
        }
        return regionName.trim();
      };

      const orders = await this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('customer.district', 'district')
        .leftJoinAndSelect('district.assignedToRegion', 'assignedToRegion')
        .leftJoinAndSelect('order.market', 'market')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .where('order.id IN (:...ids)', { ids: orderIds })
        .getMany();

      if (!orders.length) {
        throw new BadRequestException('Hech qanday buyurtma topilmadi');
      }

      for (const order of orders) {
        const printingOrder: PrintOrder = {
          orderId: order.id,
          orderPrice: formatCurrency(order.total_price),
          operator: order.operator,
          customerName: order.customer?.name ?? 'N/A',
          customerPhone: formatPhoneNumber(order.customer?.phone_number ?? ''),
          extraNumber: order.customer.extra_number,
          market: order.market?.name ?? 'N/A',
          comment: order.comment ?? '',
          region: formatRegion(order.customer.district.assignedToRegion.name),
          district: order.customer?.district?.name ?? 'N/A',
          address: order.customer?.address ?? 'N/A',
          qrCode: order.qr_code_token ?? '',
          created_time: formatDate(order.created_at),
          whereDeliver:
            order.where_deliver === Where_deliver.ADDRESS
              ? 'UYGACHA'
              : 'MARKAZGA',
          items: (order.items || []).map((i) => ({
            product: i.product?.name ?? 'N/A',
            quantity: i.quantity ?? 1,
          })),
        };

        this.queue.push(printingOrder);
      }

      this.runWorkSafely();
      return { success: true, queued: orders.length };
    } catch (error) {
      return catchError(error);
    }
  }

  private runWorkSafely() {
    if (!this.isPrinting) {
      this.startWorker();
    }
  }

  private async startWorker() {
    if (this.isPrinting) return;
    this.isPrinting = true;

    while (this.queue.length > 0) {
      const order = this.queue.shift();
      if (!order) continue;

      try {
        await this.printSingle(order);
        await new Promise((r) => setTimeout(r, 5000));
      } catch (error: any) {
        console.error(
          `❌ Print error for order ${order.orderId}:`,
          error.message,
        );
      }
    }

    this.isPrinting = false;
  }

  // ✅ To‘g‘rilangan funksiya (bitta global MQTT client orqali publish)
  private async printSingle(order: PrintOrder): Promise<void> {
    const {
      orderId,
      orderPrice,
      operator,
      customerName,
      customerPhone,
      extraNumber,
      qrCode,
      region,
      district,
      address,
      market,
      comment,
      created_time,
      whereDeliver,
      items,
    } = order;

    const maxLineLength = 40;
    let productLines: string[] = [];
    let currentLine = '';

    for (const item of items) {
      const text = `${item.product}-${item.quantity}, `;
      if ((currentLine + text).length > maxLineLength) {
        productLines.push(currentLine.trim());
        currentLine = text;
      } else {
        currentLine += text;
      }
    }

    // ⚠️ Eng muhim: oxirgi qatorni ham qo‘shamiz
    if (currentLine.trim()) {
      productLines.push(currentLine.trim());
    }

    let y = 320;
    const productTextLines = productLines
      .map((line, i) => {
        const prefix = i === 0 ? 'Mahsulot: ' : '           ';
        const result = `TEXT 20,${y},"3",0,1,1,"${prefix}${line}"`;
        y += 30;
        return result;
      })
      .join('\n');

    const tspl = `
SIZE 100 mm,60 mm
GAP 2 mm,0 mm
CLS
TEXT 175,20,"4",0,1,1,"Beepost"
TEXT 350,20,"3",0,1,1,"(${created_time})"
TEXT 20,80,"4",0,1,1,"${
      customerName.length > 20
        ? `${customerName.slice(0, 19)}...`
        : customerName
    }"
TEXT 20,120,"4",0,1,1,"${customerPhone}"
TEXT 20,170,"3",0,1,1,"${extraNumber}"
TEXT 20,190,"3",0,1,1,"-----------------------------"
TEXT 20,230,"3",0,1,1,"Narxi:"
TEXT 160,230,"3",0,1,1,"${orderPrice}"
TEXT 20,260,"3",0,1,1,"Manzil: ${region} ${district}"
TEXT 20,290,"3",0,1,1,"Mo'ljal: ${address || '-'}"
${productTextLines}
TEXT 20,${y},"3",0,1,1,"Izoh: ${comment || '-'}"
TEXT 20,${y + 30},"2",0,1,1,"Jo'natuvchi: ${market} (${whereDeliver})"
TEXT 20,${y + 60},"2",0,1,1,"Mutaxasis: ${operator || '-'}"
QRCODE 560,50,L,8,A,0,"${qrCode}"
PRINT 1
`.trim();

    try {
      if (this.client.connected) {
        this.client.publish('beepost/printer/print', tspl); // ✅ asosiy o‘zgarish
      } else {
        console.error('⚠️ MQTT ulanmagan, yuborilmadi');
      }
    } catch (err: any) {
      console.error(
        `❌ Print error for order ${orderId}:`,
        err?.message || err,
      );
      throw err;
    }
  }

  getQueueStatus() {
    return {
      pending: this.queue.length,
      isPrinting: this.isPrinting,
    };
  }

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('998') && cleaned.length === 12) {
      const code = cleaned.slice(3, 5);
      const part1 = cleaned.slice(5, 8);
      const part2 = cleaned.slice(8, 10);
      const part3 = cleaned.slice(10, 12);
      return `+998 (${code}) ${part1}-${part2}-${part3}`;
    }
    return phone;
  }

  private formatCurrency(amount: number | string): string {
    const num = Number(amount) || 0;
    return num.toLocaleString('en-US') + " so'm";
  }

  private formatDateStr(date: number | string): string {
    const createdDate = new Date(Number(date) || Date.now());
    return createdDate.toLocaleDateString('uz-UZ');
  }

  private formatRegionName(regionName?: string): string {
    if (!regionName) return '';
    if (regionName.trim().startsWith('Qoraqal')) {
      return regionName.split(' ')[0];
    }
    return regionName.trim();
  }

  private async fetchOrdersForPrint(orderIds: string[]) {
    return this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('customer.district', 'district')
      .leftJoinAndSelect('district.assignedToRegion', 'assignedToRegion')
      .leftJoinAndSelect('order.market', 'market')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.id IN (:...ids)', { ids: orderIds })
      .getMany();
  }

  async generateReceiptHtml(ordersInfoDto: CreatePrinterDto) {
    try {
      const { orderIds } = ordersInfoDto;
      if (!orderIds || orderIds.length === 0) {
        throw new BadRequestException('No orders provided');
      }

      const orders = await this.fetchOrdersForPrint(orderIds);
      if (!orders.length) {
        throw new BadRequestException('Hech qanday buyurtma topilmadi');
      }

      const receipts: string[] = [];

      for (const order of orders) {
        const customerName = order.customer?.name ?? 'N/A';
        const customerPhone = this.formatPhoneNumber(order.customer?.phone_number ?? '');
        const extraNumber = order.customer?.extra_number
          ? this.formatPhoneNumber(order.customer.extra_number)
          : '';
        const orderPrice = this.formatCurrency(order.total_price);
        const region = this.formatRegionName(order.customer?.district?.assignedToRegion?.name);
        const district = order.customer?.district?.name ?? 'N/A';
        const address = order.customer?.address ?? '-';
        const comment = order.comment ?? '-';
        const market = order.market?.name ?? 'N/A';
        const operator = order.operator ?? '-';
        const createdTime = this.formatDateStr(order.created_at);
        const whereDeliver = order.where_deliver === Where_deliver.ADDRESS ? 'UYGACHA' : 'MARKAZGA';
        const qrCode = order.qr_code_token ?? '';

        const productStr = (order.items || [])
          .map((i) => `${i.product?.name ?? 'N/A'}-${i.quantity ?? 1}`)
          .join(', ');

        let qrDataUrl = '';
        if (qrCode) {
          try {
            qrDataUrl = await QRCode.toDataURL(qrCode, { width: 140, margin: 0 });
          } catch {}
        }

        const phoneDisplay = extraNumber
          ? `${customerPhone}<br><span style="font-size:8px;color:#333">${extraNumber}</span>`
          : customerPhone;

        receipts.push(`
          <div class="cell">
            <div class="receipt">
              <div class="zone-a">
                <div class="left-panel">
                  <div class="brand-row">
                    <svg class="logo-svg" viewBox="0 0 28.17 22" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1.386 0.141L6.384 3.227C6.652 3.393 6.815 3.686 6.815 4.001V18.099C6.815 18.419 6.647 18.715 6.373 18.879L1.375 21.871C0.945 22.129 0.387 21.988 0.129 21.557C0.045 21.416 0 21.255 0 21.091V0.915C0 0.413 0.407 0.006 0.909 0.006C1.077 0.006 1.242 0.053 1.386 0.141Z" fill="#000"/>
                      <path d="M26.784 0.138L21.786 3.214C21.517 3.379 21.353 3.672 21.353 3.988V18.099C21.353 18.419 21.521 18.715 21.796 18.879L26.793 21.871C27.224 22.129 27.782 21.988 28.039 21.558C28.124 21.417 28.168 21.255 28.168 21.091V0.912C28.168 0.41 27.762 0.003 27.26 0.003C27.092 0.003 26.927 0.05 26.784 0.138Z" fill="#000"/>
                      <path d="M1.383 0.134L14.084 7.922V15.422L0 7.352V0.909C0 0.407 0.407 0 0.909 0C1.076 0 1.241 0.046 1.383 0.134Z" fill="#444"/>
                      <path d="M26.785 0.134L14.084 7.922V15.422L28.168 7.352V0.909C28.168 0.407 27.762 0 27.26 0C27.092 0 26.928 0.046 26.785 0.134Z" fill="#666"/>
                    </svg>
                    <span class="brand-text">BEEPOST</span>
                  </div>
                  ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}"/>` : ''}
                  <div class="date-text">${createdTime}</div>
                </div>
                <div class="right-panel">
                  <div class="a-row"><span class="lbl">F.I.O:</span><span class="val val-name">${customerName}</span></div>
                  <div class="a-row a-row-phone"><span class="lbl">Telefon:</span><span class="val val-phone">${phoneDisplay}</span></div>
                  <div class="a-row a-row-manzil"><span class="lbl">Manzil:</span><span class="val val-manzil">${region} ${district}</span></div>
                  <div class="a-row"><span class="lbl">Jami:</span><span class="val val-price"><b>${orderPrice}</b> <span class="deliver-badge">${whereDeliver}</span></span></div>
                  <div class="a-row a-row-last"><span class="lbl">Jo'natuvchi:</span><span class="val val-sender"><b>${market}</b> <span style="font-size:7px;color:#555">/ ${operator}</span></span></div>
                </div>
              </div>
              <div class="zone-b">
                <div class="b-row b-row-compact"><span class="lbl-b">Mahsulot:</span><span class="val-b">${productStr || '-'}</span></div>
                <div class="b-row"><span class="lbl-b">Mo'ljal:</span><span class="val-b val-b-wrap">${address || '-'}</span></div>
                <div class="b-row b-row-last"><span class="lbl-b">Izoh:</span><span class="val-b val-b-wrap">${comment || '-'}</span></div>
              </div>
            </div>
          </div>
        `);
      }

      // A4: 210mm x 297mm, margins 3mm => usable 204mm x 291mm
      // 2 columns x 6 rows = 12 receipts per page
      // Each cell: ~102mm x ~48.5mm
      const COLS = 2;
      const ROWS_PER_PAGE = 6;
      const PER_PAGE = COLS * ROWS_PER_PAGE;

      const pages: string[] = [];
      for (let p = 0; p < receipts.length; p += PER_PAGE) {
        const pageReceipts = receipts.slice(p, p + PER_PAGE);
        const rows: string[] = [];
        for (let r = 0; r < ROWS_PER_PAGE; r++) {
          const idx = r * COLS;
          const left = pageReceipts[idx] || '<div class="cell empty"></div>';
          const right = pageReceipts[idx + 1] || '<div class="cell empty"></div>';
          rows.push(`<div class="grid-row">${left}${right}</div>`);
        }
        pages.push(`<div class="page">${rows.join('\n')}</div>`);
      }

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Beepost - Chek (${orders.length} ta)</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4;margin:3mm}
  html,body{margin:0;padding:0;background:#eee;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:8px;color:#000}

  .page{
    width:204mm;height:291mm;
    margin:0 auto;background:#fff;
    display:flex;flex-direction:column;
    page-break-after:always;
    overflow:hidden;
  }
  .page:last-child{page-break-after:auto}

  .grid-row{
    display:flex;width:100%;
    flex:1;min-height:0;
    border-bottom:1px dashed #bbb;
  }
  .grid-row:last-child{border-bottom:none}

  .cell{
    width:50%;height:100%;
    padding:2mm 1.5mm;
    border-right:1px dashed #bbb;
  }
  .cell:last-child{border-right:none}
  .cell.empty{border:none}

  /* ===== RECEIPT (flexbox layout) ===== */
  .receipt{
    width:100%;height:100%;
    border:0.5px solid #333;
    display:flex;flex-direction:column;
    overflow:hidden;
  }

  /* ── ZONE A: chap panel + o'ng jadval ── */
  .zone-a{
    display:flex;
    border-bottom:0.5px solid #333;
  }

  /* Chap panel — Logo + QR + sana */
  .left-panel{
    width:24mm;flex-shrink:0;
    border-right:0.5px solid #333;
    text-align:center;
    padding:2px 2px;
    display:flex;flex-direction:column;
    align-items:center;
    gap:2px;
  }
  .brand-row{
    display:flex;align-items:center;
    justify-content:center;gap:2px;
  }
  .logo-svg{width:12px;height:9px;flex-shrink:0}
  .brand-text{font-size:9px;font-weight:bold;letter-spacing:0.3px}
  .qr{width:17mm;height:17mm;display:block}
  .date-text{font-size:9px;font-weight:bold;margin-top:auto}

  /* O'ng panel — Zone A qatorlari */
  .right-panel{
    flex:1;min-width:0;
    display:flex;flex-direction:column;
    position:relative;
  }
  .right-panel::before{
    content:'';position:absolute;
    left:14mm;top:0;bottom:0;
    border-left:0.5px solid #ddd;
    z-index:1;
  }
  .a-row{
    display:flex;align-items:stretch;
    border-bottom:0.5px solid #ccc;
  }
  .a-row-last{border-bottom:none;flex:1}

  .lbl{
    width:14mm;flex-shrink:0;
    font-size:8px;font-weight:bold;
    padding:1px 2px;
    white-space:nowrap;color:#333;
    display:flex;align-items:center;
  }
  .val{
    flex:1;min-width:0;
    font-size:9.5px;
    padding:1px 2px;
    overflow:hidden;text-overflow:ellipsis;
    white-space:nowrap;
    display:flex;align-items:center;
  }
  .val-name{font-size:10px;font-weight:bold}
  .a-row-phone,.a-row-manzil{flex:none;height:28px;overflow:hidden}
  .val-phone{
    font-size:9px;font-weight:bold;
    white-space:normal;line-height:1.3;
    display:block;overflow:hidden;
    max-height:100%;
  }
  .val-manzil{
    font-size:9px;
    white-space:normal;line-height:1.3;
    display:block;overflow:hidden;
    max-height:100%;
  }
  .val-price{font-size:10px}
  .val-sender{font-size:7.5px}
  .deliver-badge{
    font-size:6.5px;font-weight:bold;
    background:#000;color:#fff;
    padding:0.5px 3px;border-radius:2px;
    margin-left:2px;vertical-align:middle;
  }

  /* ── ZONE B: to'liq kenglik, dinamik balandlik ── */
  .zone-b{
    flex:1;min-height:0;
    display:flex;flex-direction:column;
    position:relative;
  }
  .zone-b::before{
    content:'';position:absolute;
    left:14mm;top:0;bottom:0;
    border-left:0.5px solid #ddd;
    z-index:1;
  }
  .b-row{
    flex:1;min-height:0;
    display:flex;align-items:stretch;
    border-bottom:0.5px solid #ccc;
    overflow:hidden;
  }
  .b-row-compact{flex:none}
  .b-row-last{border-bottom:none}
  .lbl-b{
    width:14mm;flex-shrink:0;
    font-size:7px;font-weight:bold;
    padding:1px 2px;
    white-space:nowrap;color:#333;
    display:flex;align-items:center;
  }
  .val-b{
    flex:1;min-width:0;
    font-size:8px;
    padding:1px 2px;
    overflow:hidden;text-overflow:ellipsis;
    white-space:nowrap;
    display:flex;align-items:center;
  }
  .val-b-wrap{
    white-space:normal;line-height:1.2;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  }

  @media print{
    html,body{background:#fff!important;margin:0!important;padding:0!important}
    .page{margin:0!important;box-shadow:none}
    .grid-row{border-color:#ccc!important}
    .cell{border-color:#ccc!important}
  }
  @media screen{
    .page{box-shadow:0 2px 8px rgba(0,0,0,0.15);margin:5mm auto}
  }
</style>
</head>
<body>
${pages.join('\n')}
<script>window.onload=function(){window.print();}</script>
</body>
</html>`;

      return { success: true, html };
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Gainscha GS-2408D (203 DPI) — 100mm(en) x 60mm(bo'y) etiketka
   *
   * PDF o'lchami AYNAN fizik etiketka o'lchamiga mos: 100mm × 60mm (landscape).
   * MUHIM: Printer driver sozlamalarida qog'oz o'lchami 100×60mm bo'lishi kerak,
   * va "Auto-rotate" o'chirilgan bo'lishi kerak.
   */
  async generateThermalReceiptPdf(ordersInfoDto: CreatePrinterDto): Promise<Buffer> {
    const { orderIds } = ordersInfoDto;
    if (!orderIds || orderIds.length === 0) {
      throw new BadRequestException('No orders provided');
    }

    const orders = await this.fetchOrdersForPrint(orderIds);
    if (!orders.length) {
      throw new BadRequestException('Hech qanday buyurtma topilmadi');
    }

    // 1mm = 2.83465 point (PDF standart)
    const MM = 2.83465;

    // Landscape PDF — fizik etiketka o'lchamiga mos: 100mm(en) × 60mm(bo'y)
    const PAGE_W = 100 * MM;  // 100mm = 283.46pt
    const PAGE_H = 60 * MM;   // 60mm  = 170.08pt

    const doc = new PDFDocument({
      size: [PAGE_W, PAGE_H],
      margin: 0,
      autoFirstPage: false,
      bufferPages: true,
    });

    // DejaVu Sans — Kirill (ruscha) harflarni qo'llab-quvvatlaydi
    const FONT_DIR = '/usr/share/fonts/truetype/dejavu';
    doc.registerFont('Sans', `${FONT_DIR}/DejaVuSans.ttf`);
    doc.registerFont('Sans-Bold', `${FONT_DIR}/DejaVuSans-Bold.ttf`);

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });

      const customerName = order.customer?.name ?? 'N/A';
      const customerPhone = this.formatPhoneNumber(order.customer?.phone_number ?? '');
      const extraNumber = order.customer?.extra_number
        ? this.formatPhoneNumber(order.customer.extra_number)
        : '';
      const orderPrice = this.formatCurrency(order.total_price);
      const region = this.formatRegionName(order.customer?.district?.assignedToRegion?.name);
      const district = order.customer?.district?.name ?? 'N/A';
      const address = order.customer?.address ?? '-';
      const comment = order.comment ?? '-';
      const market = order.market?.name ?? 'N/A';
      const operator = order.operator ?? '-';
      const createdTime = this.formatDateStr(order.created_at);
      const whereDeliver = order.where_deliver === Where_deliver.ADDRESS ? 'UYGACHA' : 'MARKAZGA';
      const qrCode = order.qr_code_token ?? '';

      const productStr = (order.items || [])
        .map((item) => `${item.product?.name ?? 'N/A'}-${item.quantity ?? 1}`)
        .join(', ');

      /*
       * TABLE LAYOUT (100mm × 60mm) — Adosh.uz stilida
       *
       * ┌─────────────────┬──────────┬──────────────────────────┐
       * │                 │ Sana:    │ 12.02.2026 14:30         │
       * │    ┌────────┐   ├──────────┼──────────────────────────┤
       * │    │  QR    │   │ F.I.O:   │ Shaxriddin Orziev        │
       * │    │  CODE  │   ├──────────┼──────────────────────────┤
       * │    └────────┘   │ Telefon: │ +998(90) 123-45-67       │
       * │                 │          │ +998901234567             │
       * │    Beepost      ├──────────┼──────────────────────────┤
       * │                 │ Manzil:  │ Toshkent, Yunusobod      │
       * │  Jami:          │          │                          │
       * │  150,000 so'm   ├──────────┼──────────────────────────┤
       * │                 │ Jami:    │ 150,000 so'm  UYGACHA    │
       * │  UYGACHA        ├──────────┼──────────────────────────┤
       * │                 │ Operator:│ BeeMarket / Admin        │
       * ├─────────────────┴──────────┴──────────────────────────┤
       * │ Mahsulot: │ Kitob-2, Ruchka-3                         │
       * │ Mo'ljal:  │ Ko'cha 12, uy 5                           │
       * │ Izoh:     │ Tez yetkazish                             │
       * └─────────────────┴──────────┴──────────────────────────┘
       */

      // ====== LAYOUT O'LCHAMLARI ======
      const M = 2 * MM;
      const FULL_W = PAGE_W - 2 * M;
      const LEFT_W = 28 * MM;
      const RIGHT_X = M + LEFT_W;
      const RIGHT_W = FULL_W - LEFT_W;
      const LABEL_COL = 17 * MM;     // Label ustuni
      const PAD = 3;
      const TABLE_TOP = M;
      const TABLE_BOT = PAGE_H - M;
      const TABLE_H = TABLE_BOT - TABLE_TOP;

      // ── ZONE B: Mahsulot va Mo'ljal 1 qator, Izoh 2 qator ──
      const MAHSULOT_H = 16;
      const MOLJAL_H = 16;
      const ZONE_B_H = 58;
      const IZOH_H = ZONE_B_H - MAHSULOT_H - MOLJAL_H; // 26
      const B_LABEL_COL = 17 * MM;
      const B_VALUE_X = M + B_LABEL_COL;
      const B_VALUE_W = FULL_W - B_LABEL_COL;
      const availBW = B_VALUE_W - 2 * PAD;

      const zoneBTexts = [
        productStr || '-',
        address || '-',
        comment || '-',
      ];

      const zoneBRows = [
        { label: 'Mahsulot:', h: MAHSULOT_H },
        { label: "Mo'ljal:", h: MOLJAL_H },
        { label: 'Izoh:',    h: IZOH_H },
      ];

      // ── ZONE A: Qolgan barcha joy (chap=logo+QR+sana | o'ng=jadval) ──
      const ZONE_A_H = TABLE_H - ZONE_B_H;
      const ZONE_B_Y = TABLE_TOP + ZONE_A_H;

      const zoneARows = [
        { label: 'F.I.O:',    h: 16 },
        { label: 'Telefon:',  h: 28 },
        { label: 'Manzil:',   h: 28 },
        { label: 'Jami:',     h: 15 },
        { label: "Jo'natuvchi:", h: 0 },    // qoldiq
      ];
      const zoneAFixed = zoneARows.slice(0, -1).reduce((s, r) => s + r.h, 0);
      zoneARows[zoneARows.length - 1].h = ZONE_A_H - zoneAFixed;

      // Zone A qiymatlari
      const phoneValue = extraNumber
        ? `${customerPhone}\n${extraNumber}`
        : customerPhone;
      const zoneAValues = [
        customerName,
        phoneValue,
        `${region} ${district}`,
        `${orderPrice}   ${whereDeliver}`,
        `${market} / ${operator}`,
      ];

      // ====== CHAP PANEL (logo + brend + QR + sana) ======
      doc.lineWidth(0.5);
      doc.rect(M, TABLE_TOP, LEFT_W, ZONE_A_H).stroke();

      // Logo + "BEEPOST"
      let leftY = TABLE_TOP + 5;
      const logoScale = 0.5;
      const logoW = 29 * logoScale;
      const logoH = 22 * logoScale;
      doc.font('Sans-Bold').fontSize(11);
      const brandText = 'BEEPOST';
      const brandW = doc.widthOfString(brandText);
      const totalBrandW = logoW + 3 + brandW;
      const brandStartX = M + (LEFT_W - totalBrandW) / 2;

      // Beepost logo (SVG paths)
      doc.save();
      doc.translate(brandStartX, leftY);
      doc.scale(logoScale);
      doc.path('M1.38591 0.141343L6.38352 3.22731C6.65167 3.39289 6.81493 3.68563 6.81493 4.00089V18.0987C6.81493 18.4185 6.64707 18.7147 6.37285 18.8788L1.37524 21.8707C0.94461 22.1285 0.386623 21.9882 0.128938 21.5574C0.0445607 21.4164 0 21.255 0 21.0906V0.914925C0 0.412862 0.40682 0.00585938 0.908658 0.00585938C1.07722 0.00585938 1.24246 0.0527689 1.38591 0.141343Z').fill('#000');
      doc.path('M26.7836 0.137942L21.786 3.21357C21.5172 3.379 21.3534 3.67212 21.3534 3.98786V18.0989C21.3534 18.4186 21.5213 18.7148 21.7955 18.879L26.7931 21.8709C27.2237 22.1287 27.7817 21.9884 28.0394 21.5576C28.1238 21.4165 28.1683 21.2552 28.1683 21.0908V0.91224C28.1683 0.410177 27.7615 0.00317383 27.2597 0.00317383C27.0916 0.00317383 26.9268 0.0498263 26.7836 0.137942Z').fill('#000');
      doc.path('M1.38349 0.133995L14.0842 7.9218V15.4216L0 7.35155V0.909066C0 0.407003 0.40682 0 0.908657 0C1.07626 0 1.24059 0.0463746 1.38349 0.133995Z').fill('#444');
      doc.path('M26.7848 0.133995L14.0841 7.9218V15.4216L28.1683 7.35155V0.909066C28.1683 0.407003 27.7615 0 27.2597 0C27.0921 0 26.9277 0.0463746 26.7848 0.133995Z').fill('#666');
      doc.restore();

      doc.font('Sans-Bold').fontSize(11);
      doc.text(brandText, brandStartX + logoW + 3, leftY + (logoH - 11) / 2, { lineBreak: false });
      leftY += logoH + 5;

      // QR Code
      const qrSize = 20 * MM;
      const qrX = M + (LEFT_W - qrSize) / 2;
      if (qrCode) {
        try {
          const qrBuffer = await QRCode.toBuffer(qrCode, {
            width: 180,
            margin: 0,
            errorCorrectionLevel: 'L',
          });
          doc.image(qrBuffer, qrX, leftY, { width: qrSize, height: qrSize });
        } catch {}
      }
      leftY += qrSize + 5;

      // Sana — QR ostida, markazda
      doc.font('Sans-Bold').fontSize(9);
      doc.text(createdTime, M, leftY, {
        width: LEFT_W,
        align: 'center',
        lineBreak: false,
      });

      // ====== O'NG PANEL — Zone A jadval ======
      const A_VALUE_X = RIGHT_X + LABEL_COL;
      const A_VALUE_W = RIGHT_W - LABEL_COL;

      doc.rect(RIGHT_X, TABLE_TOP, RIGHT_W, ZONE_A_H).stroke();
      doc.moveTo(A_VALUE_X, TABLE_TOP).lineTo(A_VALUE_X, TABLE_TOP + ZONE_A_H).stroke();

      let rowY = TABLE_TOP;
      for (let r = 0; r < zoneARows.length; r++) {
        const row = zoneARows[r];
        const val = zoneAValues[r];

        if (r > 0) {
          doc.moveTo(RIGHT_X, rowY).lineTo(RIGHT_X + RIGHT_W, rowY).stroke();
        }

        // Value — maxsus formatlash
        const isName = r === 0;
        const isPhone = r === 1;
        const isJami = r === 3;
        const isSender = r === 4;

        // Label (Jo'natuvchi o'zi chizadi — markazda)
        if (!isSender) {
          doc.font('Sans-Bold').fontSize(6.5);
          doc.text(row.label, RIGHT_X + PAD, rowY + PAD, { lineBreak: false });
        }
        const valW = A_VALUE_W - 2 * PAD;

        if (isJami) {
          // Narx (katta bold) | yetkazish turi (kichik bold)
          doc.font('Sans-Bold').fontSize(9);
          const priceW = doc.widthOfString(orderPrice);
          doc.text(orderPrice, A_VALUE_X + PAD, rowY + PAD, { lineBreak: false });
          doc.font('Sans-Bold').fontSize(7);
          doc.text(' | ' + whereDeliver, A_VALUE_X + PAD + priceW, rowY + PAD + 2, { lineBreak: false });
        } else if (isSender) {
          // Market (bold) | operator (oddiy) — vertikalda markazda
          const senderFontSize = 8.5;
          const senderLblY = rowY + (row.h - 6.5) / 2;
          const senderValY = rowY + (row.h - senderFontSize) / 2;
          // Labelni markazda chizish
          doc.font('Sans-Bold').fontSize(6.5);
          doc.text(row.label, RIGHT_X + PAD, senderLblY, { lineBreak: false });
          // Valueni markazda chizish
          doc.save();
          doc.rect(A_VALUE_X, rowY, A_VALUE_W, row.h).clip();
          doc.font('Sans-Bold').fontSize(senderFontSize);
          const mktW = doc.widthOfString(market);
          doc.text(market, A_VALUE_X + PAD, senderValY, { lineBreak: false });
          doc.font('Sans').fontSize(7);
          doc.text(' | ' + operator, A_VALUE_X + PAD + mktW, senderValY + 1.5, { lineBreak: false });
          doc.restore();
        } else {
          if (isPhone) {
            doc.font('Sans-Bold').fontSize(9);
          } else if (isName) {
            doc.font('Sans-Bold').fontSize(9.5);
          } else {
            doc.font('Sans').fontSize(8.5);
          }

          doc.text(val, A_VALUE_X + PAD, rowY + PAD, {
            width: valW,
            lineBreak: true,
            height: row.h - 2 * PAD,
            ellipsis: true,
          });
        }

        rowY += row.h;
      }

      // ====== ZONE B — to'liq kenglikdagi jadval (manzil, mahsulot, izoh) ======
      doc.rect(M, ZONE_B_Y, FULL_W, TABLE_BOT - ZONE_B_Y).stroke();
      doc.moveTo(B_VALUE_X, ZONE_B_Y).lineTo(B_VALUE_X, TABLE_BOT).stroke();

      let bRowY = ZONE_B_Y;
      for (let r = 0; r < zoneBRows.length; r++) {
        const row = zoneBRows[r];
        const val = zoneBTexts[r];

        if (r > 0) {
          doc.moveTo(M, bRowY).lineTo(M + FULL_W, bRowY).stroke();
        }

        doc.font('Sans-Bold').fontSize(6.5);
        doc.text(row.label, M + PAD, bRowY + PAD, { lineBreak: false });

        doc.font('Sans').fontSize(8);
        doc.text(val, B_VALUE_X + PAD, bRowY + PAD, {
          width: availBW,
          lineBreak: true,
          height: row.h - 2 * PAD,
          ellipsis: true,
        });

        bRowY += row.h;
      }
    }

    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}
