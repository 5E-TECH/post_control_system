import { BadRequestException, Injectable } from '@nestjs/common';
import { catchError } from 'src/infrastructure/lib/response';
import { writeFile } from 'fs/promises';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { PrintOrder } from 'src/common/utils/types/order.interface';
import { In } from 'typeorm';
import { existsSync } from 'fs';

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

  async printLabel(orderId: string, receiver: string): Promise<string> {
    try {
      const tspl = `
SIZE 40 mm,30 mm
GAP 2 mm,0 mm
CLS
TEXT 20,20,"3",0,1,1,"Post Control System"
TEXT 20,60,"3",0,1,1,"Order #${orderId}"
TEXT 20,100,"3",0,1,1,"Receiver: ${receiver}"
BARCODE 20,140,"128",50,1,0,2,2,"${orderId}"
PRINT 1
`;

      // 🔥 Printerga bevosita yozish
      await writeFile('/dev/usb/lp0', tspl);

      console.log('🖨️ Label printed successfully (no sudo)!');
      return 'Printed successfully';
    } catch (error) {
      console.error('❌ Print error:', error);
      return catchError(error);
    }
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

      // Find orders with client relation
      const orders = await this.orderRepo.find({
        where: { id: In(orderIds) },
        relations: ['customer', 'customer.district'],
      });
      for (const order of orders) {
        const printingOrder: PrintOrder = {
          orderId: order.id,
          orderPrice: formatCurrency(order.total_price),
          customerName: order.customer.name,
          customerPhone: formatPhoneNumber(order.customer.phone_number),
          district: order.customer.district.name,
          address: order.customer.address,
          qrCode: order.qr_code_token,
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
        await new Promise((r) => setTimeout(r, 1000)); // kichik delay
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
    } = order;

    const tspl = `
SIZE 100 mm,60 mm
GAP 2 mm,0 mm
CLS

TEXT 325,20,"4",0,1,1,"Beepost"

TEXT 20,80,"4",0,1,1,"${customerName}"
TEXT 20,120,"4",0,1,1,"${customerPhone}"

TEXT 20,200,"3",0,1,1,"Narxi:"
TEXT 160,200,"3",0,1,1,"${orderPrice}"

TEXT 20,240,"3",0,1,1,"Tuman: ${district}"
TEXT 20,280,"3",0,1,1,"Manzil: ${address}"



QRCODE 560,50,L,8,A,0,"${qrCode}"
BARCODE 100,350,"128",100,1,0,2,2,"${qrCode}"

PRINT 1
`;

    if (!existsSync(this.printerPath)) {
      throw new Error('Printer not connected');
    }

    await writeFile(this.printerPath, tspl);
    console.log(`✅ Printed order: ${orderId}`);
  }

  /**
   * 🔍 Queue holatini ko‘rish
   */
  getQueueStatus() {
    return {
      pending: this.queue.length,
      isPrinting: this.isPrinting,
    };
  }
}
