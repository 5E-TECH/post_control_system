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
}
