import { BadRequestException, Injectable } from '@nestjs/common';
import { catchError } from 'src/infrastructure/lib/response';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { PrintOrder } from 'src/common/utils/types/order.interface';
import { In } from 'typeorm';
import axios from 'axios';
import config from 'src/config';

@Injectable()
export class PrinterService {
  private readonly queue: PrintOrder[] = [];
  private isPrinting = false;

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,
  ) {}

  onModuleInit() {
    console.log('🖨️ PrinterService initialized');
  }

  async printMultiple(ordersInfoDto: CreatePrinterDto) {
    try {
      const { orderIds } = ordersInfoDto;
      if (!orderIds || orderIds.length === 0) {
        throw new BadRequestException('⚠️ No orders provided');
      }

      // format helpers
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

      // 🔹 Orderlarni bazadan olish
      const orders = await this.orderRepo.find({
        where: { id: In(orderIds) },
        relations: [
          'customer',
          'market',
          'customer.district',
          'items',
          'items.product',
        ],
      });

      if (!orders.length) {
        throw new BadRequestException('Hech qanday buyurtma topilmadi');
      }

      // 🔹 Har bir orderni printing queue’ga qo‘shamiz
      for (const order of orders) {
        const printingOrder: PrintOrder = {
          orderId: order.id,
          orderPrice: formatCurrency(order.total_price),
          customerName: order.customer?.name ?? 'N/A',
          customerPhone: formatPhoneNumber(order.customer?.phone_number ?? ''),
          market: order.market?.name ?? 'N/A',
          comment: order.comment ?? '',
          district: order.customer?.district?.name ?? 'N/A',
          address: order.customer?.address ?? 'N/A',
          qrCode: order.qr_code_token ?? '',
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
        await new Promise((r) => setTimeout(r, 2000)); // delay
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

  private async printSingle(order: PrintOrder): Promise<void> {
    const {
      orderId,
      orderPrice,
      customerName,
      customerPhone,
      qrCode,
      district,
      address,
      market,
      comment,
    } = order;

    const tspl = `
SIZE 100 mm,60 mm
GAP 2 mm,0 mm
CLS
TEXT 325,20,"4",0,1,1,"Beepost"
TEXT 20,80,"4",0,1,1,"${customerName.length > 20 ? `${customerName.slice(0, 19)}...` : customerName}"
TEXT 20,120,"4",0,1,1,"${customerPhone}"
TEXT 20,150,"3",0,1,1,"-----------------------------"
TEXT 20,180,"3",0,1,1,"Narxi:"
TEXT 160,180,"3",0,1,1,"${orderPrice}"
TEXT 20,220,"3",0,1,1,"Tuman: ${district}"
TEXT 20,260,"3",0,1,1,"Manzil: ${address}"
TEXT 20,300,"3",0,1,1,"Izoh: ${comment || '-'}"
TEXT 20,330,"2",0,1,1,"${market}"
QRCODE 560,50,L,8,A,0,"${qrCode}"
BARCODE 100,370,"128",100,1,0,2,2,"${qrCode}"
PRINT 1`.trim();

    console.log(`🖨️ Printing order: ${orderId}`);
    try {
      await axios.post(
        config.PRINTER_LOCAL_URL,
        { tspl },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }, // ⚙️ aniq yozamiz
        },
      );
      console.log(`✅ Printed order: ${orderId}`);
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
