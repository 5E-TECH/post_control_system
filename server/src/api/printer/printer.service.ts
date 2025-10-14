import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { writeFile } from 'fs/promises';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { PrintOrder } from 'src/common/utils/types/order.interface';
import { In } from 'typeorm';
import { existsSync } from 'fs';
import axios from 'axios';
import config from 'src/config';

@Injectable()
export class PrinterService {
  private readonly queue: PrintOrder[] = [];
  private isPrinting = false;
  private readonly printerPath = '/dev/usb/lp0';
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
      if (orderIds.length === 0) {
        throw new BadRequestException('⚠️ No orders provided');
      }

      // Telefon raqamini UZB formatda chiqarish
      function formatPhoneNumber(phone: string): string {
        // faqat raqamlarni qoldiramiz
        const cleaned = phone.replace(/\D/g, '');
        // 998 bilan boshlanayotgan format uchun
        if (cleaned.startsWith('998') && cleaned.length === 12) {
          const code = cleaned.slice(3, 5);
          const part1 = cleaned.slice(5, 8);
          const part2 = cleaned.slice(8, 10);
          const part3 = cleaned.slice(10, 12);
          return `+998 (${code}) ${part1}-${part2}-${part3}`;
        }
        // agar boshqa format bo'lsa — o‘zgarmagan holda qaytaramiz
        return phone;
      }

      function formatCurrency(amount: number | string): string {
        const num = Number(amount) || 0;
        return num.toLocaleString('en-US') + " so'm";
      }

      // 1️⃣ Production backend API’dan order ma’lumotlarini olish
      const orders = await this.orderRepo.find({ where: { id: In(orderIds) } });

      // Find orders with client relation
      // const orders = await this.orderRepo.find({
      //   where: { id: In(orderIds) },
      //   relations: [
      //     'items',
      //     'items.product',
      //     'market',
      //     'customer',
      //     'customer.district',
      //   ],
      // });
      for (const order of orders) {
        console.log('test buyurtma', order);

        const printingOrder: PrintOrder = {
          orderId: order.id,
          orderPrice: formatCurrency(order.total_price),
          customerName: order.customer.name,
          customerPhone: formatPhoneNumber(order.customer.phone_number),
          market: order.market.name,
          comment: order.comment,
          district: order.customer.district.name,
          address: order.customer.address,
          qrCode: order.qr_code_token,
          items: {
            product: order.customer.name,
            quantity: order.product_quantity,
          },
        };
        this.queue.push(printingOrder);
      }

      this.runWorkSafely();
      console.log(`📦 Added ${orders.length} orders to print queue`);
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
    if (this.isPrinting) return; // Agar allaqachon ishlayotgan bo‘lsa, chiqadi
    this.isPrinting = true;

    while (this.queue.length > 0) {
      const order = this.queue.shift();
      if (!order) continue;

      try {
        await this.printSingle(order);
        await new Promise((r) => setTimeout(r, 3000)); // kichik delay
      } catch (error) {
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
TEXT 20,300,"3",0,1,1,"Comment: ${comment}"

TEXT 20,330,"2",0,1,1,"${market} --> ${market}"

QRCODE 560,50,L,8,A,0,"${qrCode}"
BARCODE 100,370,"128",100,1,0,2,2,"${qrCode}"

PRINT 1
`;

    // await writeFile(this.printerPath, tspl);
    console.log(`Printing progress for order: ${orderId}`);
    axios
      .post(config.PRINTER_LOCAL_URL, tspl)
      .then((res) => console.log(`✅ Printed order: ${orderId}`))
      .catch((err) => {
        console.log(err);
      });
  }

  getQueueStatus() {
    return {
      pending: this.queue.length,
      isPrinting: this.isPrinting,
    };
  }
}
