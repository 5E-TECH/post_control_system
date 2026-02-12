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
TEXT 20,260,"3",0,1,1,"Tuman: ${region} ${district}"
TEXT 20,290,"3",0,1,1,"Manzil: ${address || '-'}"
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

  /**
   * Termal printerga mos formatda cheklar generatsiya qilish (TSPL labelga o'xshash)
   * Auto-print yo'q — foydalanuvchi o'zi chop etadi yoki PDF saqlaydi
   */
  async generateThermalReceiptHtml(ordersInfoDto: CreatePrinterDto) {
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
        const extraNumber = order.customer?.extra_number ?? '';
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

        // Mahsulotlarni TSPL formatga mos: "product-qty, product-qty, ..."
        const productStr = (order.items || [])
          .map((i) => `${i.product?.name ?? 'N/A'}-${i.quantity ?? 1}`)
          .join(', ');

        let qrDataUrl = '';
        if (qrCode) {
          try {
            qrDataUrl = await QRCode.toDataURL(qrCode, { width: 120, margin: 0 });
          } catch {}
        }

        const truncName = customerName.length > 20
          ? customerName.slice(0, 19) + '...'
          : customerName;

        receipts.push(`
          <div class="label">
            <div class="top-section">
              <div class="top-left">
                <div class="row-header">
                  <span class="brand">Beepost</span>
                  <span class="date">(${createdTime})</span>
                </div>
                <div class="name">${truncName}</div>
                <div class="phone">${customerPhone}</div>
                ${extraNumber ? `<div class="extra">${extraNumber}</div>` : ''}
              </div>
              ${qrDataUrl ? `<div class="top-right"><img class="qr" src="${qrDataUrl}"/></div>` : ''}
            </div>
            <div class="sep"></div>
            <div class="row"><b>Narxi:</b> ${orderPrice} &nbsp; | &nbsp; ${whereDeliver}</div>
            <div class="row">Tuman: ${region} ${district}</div>
            <div class="row">Manzil: ${address || '-'}</div>
            <div class="row wrap">Mahsulot: ${productStr}</div>
            <div class="row">Izoh: ${comment || '-'}</div>
            <div class="sep"></div>
            <div class="footer">Jo'natuvchi: ${market}</div>
            <div class="footer">Mutaxasis: ${operator || '-'}</div>
          </div>
        `);
      }

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Beepost - Termal chek (${orders.length} ta)</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}

  /* 60mm kenglik x 100mm balandlik — PORTRAIT */
  @page{
    size:60mm 100mm;
    margin:0;
  }

  html,body{
    margin:0;padding:0;
    background:#eee;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }
  body{font-family:'Courier New',Consolas,monospace;color:#000}

  /* Toolbar */
  .toolbar{
    position:fixed;top:0;left:0;right:0;z-index:100;
    background:#fff;border-bottom:2px solid #7c3aed;
    padding:8px 16px;display:flex;align-items:center;gap:10px;justify-content:center;flex-wrap:wrap;
  }
  .toolbar button{
    padding:7px 18px;border:none;border-radius:8px;font-size:13px;
    font-weight:600;cursor:pointer;
  }
  .btn-print{background:#7c3aed;color:#fff}
  .btn-print:hover{background:#6d28d9}
  .btn-pdf{background:#059669;color:#fff}
  .btn-pdf:hover{background:#047857}
  .toolbar-info{font-size:12px;color:#666}
  .print-hint{font-size:11px;color:#e11d48;font-weight:600;text-align:center}
  .content{padding-top:70px}

  /* Label — 60mm x 100mm portrait */
  .label{
    width:60mm;height:100mm;
    margin:3mm auto;padding:2mm 2.5mm;
    background:#fff;border:1px solid #999;
    page-break-after:always;
    page-break-inside:avoid;
    overflow:hidden;
  }
  .label:last-child{page-break-after:auto}

  /* Tepa qism: ism+telefon chapda, QR o'ngda */
  .top-section{display:flex;gap:1.5mm;margin-bottom:0.5mm}
  .top-left{flex:1;min-width:0;overflow:hidden}
  .top-right{flex-shrink:0;display:flex;align-items:flex-start;justify-content:center}
  .qr{width:18mm;height:18mm}

  .row-header{display:flex;align-items:baseline;gap:2mm;margin-bottom:0.3mm}
  .brand{font-size:13px;font-weight:bold}
  .date{font-size:8px;color:#333}
  .name{font-size:12px;font-weight:bold;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .phone{font-size:11px;font-weight:bold;line-height:1.25}
  .extra{font-size:8px;color:#333;line-height:1.2}
  .sep{border-top:1px dashed #000;margin:1mm 0}
  .row{font-size:9px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row.wrap{white-space:normal;word-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .footer{font-size:8px;line-height:1.3;color:#222}

  /* ===== PRINT ===== */
  @media print{
    html,body{
      background:#fff!important;
      margin:0!important;padding:0!important;
      width:100%;height:100%;
    }
    .toolbar{display:none!important}
    .content{padding-top:0!important;margin:0!important}
    .label{
      border:none!important;
      margin:0!important;
      box-shadow:none;
      width:100vw!important;
      height:100vh!important;
      padding:2mm 2.5mm;
    }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button class="btn-print" onclick="window.print()">Chop etish</button>
  <button class="btn-pdf" onclick="window.print()">PDF saqlash</button>
  <span class="toolbar-info">${orders.length} ta chek &nbsp;|&nbsp; 60x100mm</span>
  <span class="print-hint">Print: Margins=None, Scale=100%</span>
</div>
<div class="content">
${receipts.join('\n')}
</div>
</body>
</html>`;

      return { success: true, html };
    } catch (error) {
      return catchError(error);
    }
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
        const extraNumber = order.customer?.extra_number ?? '';
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

        const items = (order.items || []).map(
          (i) => `${i.product?.name ?? 'N/A'} x ${i.quantity ?? 1}`,
        );

        let qrDataUrl = '';
        if (qrCode) {
          try {
            qrDataUrl = await QRCode.toDataURL(qrCode, { width: 80, margin: 0 });
          } catch {}
        }

        const truncName = customerName.length > 20 ? customerName.slice(0, 19) + '...' : customerName;

        receipts.push(`
          <div class="cell">
            <div class="receipt">
              <div class="main">
                <div class="content">
                  <div class="header"><b>Beepost</b> <span>(${createdTime})</span></div>
                  <div class="name">${truncName}</div>
                  <div>${customerPhone}</div>
                  ${extraNumber ? `<div class="extra">${extraNumber}</div>` : ''}
                  <div class="sep"></div>
                  <div><b>Narxi:</b> ${orderPrice}</div>
                  <div><b>Tuman:</b> ${region} ${district}</div>
                  <div><b>Manzil:</b> ${address || '-'}</div>
                  <div><b>Mahsulot:</b> ${items.join(', ')}</div>
                  <div><b>Izoh:</b> ${comment}</div>
                  <div class="sep"></div>
                  <div class="foot">Jo'natuvchi: <b>${market}</b> (${whereDeliver})</div>
                  <div class="foot">Mutaxasis: ${operator}</div>
                </div>
                ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}"/></div>` : ''}
              </div>
            </div>
          </div>
        `);
      }

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Beepost - Chek</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4;margin:5mm}
  html,body{width:100%;height:100%}
  body{font-family:'Courier New',monospace;font-size:11px;color:#000;background:#fff}
  .wrapper{position:relative}
  .row{display:flex;width:100%}
  .cell{width:50%;padding:2mm 3mm;box-sizing:border-box}
  .receipt{border:1px solid #000;padding:2mm;overflow:hidden;height:100%}
  .cut-h{position:relative;width:100%;height:5mm;display:flex;align-items:center}
  .cut-h::before{content:'\\2702';position:absolute;left:0;top:50%;transform:translateY(-50%);font-size:12px;color:#999;z-index:1}
  .cut-h::after{content:'';position:absolute;left:14px;right:0;top:50%;border-top:1px dashed #999}
  .cut-v{position:absolute;top:0;bottom:0;left:50%;width:6mm;margin-left:-3mm;z-index:2;pointer-events:none}
  .cut-v::before{content:'\\2702';position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(90deg);font-size:12px;color:#999;z-index:1}
  .cut-v::after{content:'';position:absolute;top:14px;bottom:0;left:50%;border-left:1px dashed #999}
  .main{display:flex;gap:3mm}
  .content{flex:1;min-width:0}
  .content div{line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .header{font-size:13px;margin-bottom:1px}
  .header span{font-size:10px;color:#555}
  .name{font-size:14px;font-weight:bold}
  .extra{font-size:10px;color:#555}
  .sep{border-top:1px dashed #000;margin:2px 0}
  .foot{font-size:10px}
  .qr{flex-shrink:0;display:flex;align-items:center}
  .qr img{width:65px;height:65px}
  @media print{html,body{width:100%;margin:0}.receipt{border:1px solid #aaa}.cut-h::after{border-color:#bbb}.cut-v::after{border-color:#bbb}}
</style>
</head>
<body>
<div class="wrapper">
<div class="cut-v"></div>
${(() => {
  const rows: string[] = [];
  for (let i = 0; i < receipts.length; i += 2) {
    if (i > 0) rows.push('<div class="cut-h"></div>');
    rows.push('<div class="row">' + receipts[i] + (receipts[i+1] || '<div class="cell"></div>') + '</div>');
  }
  return rows.join('\n');
})()}
</div>
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
       * │  Jami:          │          │ Ko'cha 12, uy 5          │
       * │  150,000 so'm   ├──────────┼──────────────────────────┤
       * │                 │ Mahsulot:│ Kitob-2, Ruchka-3        │
       * │  UYGACHA        ├──────────┼──────────────────────────┤
       * │                 │ Izoh:    │ Tez yetkazish            │
       * │                 ├──────────┼──────────────────────────┤
       * │                 │ Jami:    │ 150,000 so'm  UYGACHA    │
       * │                 ├──────────┼──────────────────────────┤
       * │                 │ Operator:│ BeeMarket / Admin        │
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

      // ── ZONE B: Mahsulot belgilangan, Manzil/Izoh dinamik ──
      const MAHSULOT_H = 16;              // 1 qator (belgilangan)
      const ZONE_B_H = 64;               // umumiy Zone B balandligi
      const MI_H = ZONE_B_H - MAHSULOT_H; // Manzil + Izoh uchun qolgan joy
      const B_LABEL_COL = 17 * MM;
      const B_VALUE_X = M + B_LABEL_COL;
      const B_VALUE_W = FULL_W - B_LABEL_COL;
      const availBW = B_VALUE_W - 2 * PAD;

      const zoneBTexts = [
        productStr || '-',
        address || '-',
        comment || '-',
      ];

      // Manzil va Izoh uchun kerakli balandlikni o'lchash
      doc.font('Sans').fontSize(8);
      const manzilNeed = Math.max(doc.heightOfString(zoneBTexts[1], { width: availBW }) + 2 * PAD, 14);
      const izohNeed = Math.max(doc.heightOfString(zoneBTexts[2], { width: availBW }) + 2 * PAD, 14);
      const miTotal = manzilNeed + izohNeed;
      const manzilH = Math.max(14, Math.round(MI_H * manzilNeed / miTotal));

      const zoneBRows = [
        { label: 'Mahsulot:', h: MAHSULOT_H },
        { label: 'Manzil:',  h: manzilH },
        { label: 'Izoh:',    h: MI_H - manzilH },
      ];

      // ── ZONE A: Qolgan barcha joy (chap=logo+QR+sana | o'ng=jadval) ──
      const ZONE_A_H = TABLE_H - ZONE_B_H;
      const ZONE_B_Y = TABLE_TOP + ZONE_A_H;

      const zoneARows = [
        { label: 'F.I.O:',    h: 18 },
        { label: 'Telefon:',  h: 32 },
        { label: 'Tuman:',    h: 16 },
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

        // Label
        doc.font('Sans-Bold').fontSize(6.5);
        doc.text(row.label, RIGHT_X + PAD, rowY + PAD, { lineBreak: false });

        // Value — maxsus formatlash
        const isName = r === 0;
        const isPhone = r === 1;
        const isJami = r === 3;
        const isSender = r === 4;
        const valW = A_VALUE_W - 2 * PAD;

        if (isJami) {
          // Narx (katta bold) | yetkazish turi (kichik bold)
          doc.font('Sans-Bold').fontSize(9);
          const priceW = doc.widthOfString(orderPrice);
          doc.text(orderPrice, A_VALUE_X + PAD, rowY + PAD, { lineBreak: false });
          doc.font('Sans-Bold').fontSize(7);
          doc.text(' | ' + whereDeliver, A_VALUE_X + PAD + priceW, rowY + PAD + 2, { lineBreak: false });
        } else if (isSender) {
          // Market (bold) | operator (oddiy) — ramkadan chiqmasin
          doc.save();
          doc.rect(A_VALUE_X, rowY, A_VALUE_W, row.h).clip();
          doc.font('Sans-Bold').fontSize(8.5);
          const mktW = doc.widthOfString(market);
          doc.text(market, A_VALUE_X + PAD, rowY + PAD, { lineBreak: false });
          doc.font('Sans').fontSize(7);
          doc.text(' | ' + operator, A_VALUE_X + PAD + mktW, rowY + PAD + 1.5, { lineBreak: false });
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
