import { BadRequestException, Injectable } from '@nestjs/common';
import { catchError } from 'src/infrastructure/lib/response';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { PrintOrder } from 'src/common/utils/types/order.interface';
import mqtt from 'mqtt'; // ✅ kerak
import { Where_deliver } from 'src/common/enums';

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
    console.log('🖨️ PrinterService initialized');

    // ✅ MQTT clientni faqat 1 marta yaratamiz (har orderda emas)
    this.client = mqtt.connect('mqtt://13.234.20.96:1883', {
      username: 'shodiyor',
      password: 'root',
      reconnectPeriod: 2000,
      connectTimeout: 5000,
    });
    this.client.on('connect', () => {
      console.log('📡 MQTT brokerga ulandi');
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
      console.log(`📦 Added ${orders.length} orders to print queue`);
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
    console.log('🕓 All queued prints completed');
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
TEXT 20,${y + 60},"2",0,1,1,"Mutaxasis: ${operator}"
QRCODE 560,50,L,8,A,0,"${qrCode}"
PRINT 1
`.trim();

    console.log(`🖨️ Printing order: ${orderId}`);

    try {
      if (this.client.connected) {
        this.client.publish('beepost/printer/print', tspl); // ✅ asosiy o‘zgarish
        console.log(`📤 MQTT orqali yuborildi (${orderId})`);
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
}
