// src/printer/printer.service.ts
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
import { In } from 'typeorm';
import { existsSync } from 'fs';
import axios from 'axios';
import * as https from 'https';
import config from 'src/config';

type PrintJob = { orderId: number | string; tspl: string };

@Injectable()
export class PrinterService {
  private readonly queue: PrintJob[] = [];
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
      if (!orderIds || orderIds.length === 0) {
        throw new BadRequestException('⚠️ No orders provided');
      }

      // fetch orders first (we need full data to build TSPL)
      const orders = await this.orderRepo.find({
        where: { id: In(orderIds) },
        relations: [
          'items',
          'items.product',
          'market',
          'customer',
          'customer.district',
        ],
      });

      if (!orders || orders.length === 0) {
        throw new NotFoundException('Orders not found');
      }

      const printerServerUrl = config.PRINTER_LOCAL_URL;
      console.log('PRINTER_LOCAL_URL =', printerServerUrl);

      // === Remote path ===
      if (printerServerUrl) {
        console.log(
          '🌍 Remote printer detected, building TSPL and sending to remote...',
        );
        const tsplBatch = orders
          .map((o) => this.buildTsplForOrder(o))
          .join('\n');

        try {
          const response = await axios.post(
            `${printerServerUrl}/printer/raw`,
            { tspl: tsplBatch },
            {
              timeout: 15000,
              httpsAgent: new https.Agent({ rejectUnauthorized: false }), // debug only; fix certs for prod
            },
          );
          console.log(
            '📡 Remote printer responded:',
            response.status,
            response.data,
          );
          return successRes(
            '✅ Print so‘rov yuborildi (remote printer)',
            response.data,
          );
        } catch (err: any) {
          console.error(
            '❌ Remote print error:',
            err?.response?.status,
            err?.response?.data,
            err?.message,
          );
          return catchError(err);
        }
      }

      // === Local path ===
      console.log(
        '🖨️ Local printer detected, queueing jobs for /dev/usb/lp0...',
      );
      for (const order of orders) {
        const tspl = this.buildTsplForOrder(order);
        this.queue.push({ orderId: order.id, tspl });
      }

      this.runWorkSafely();
      console.log(`📦 Added ${orders.length} orders to print queue`);
      return successRes(
        {
          queued: orders.length,
        },
        200,
        '✅ Orders queued for local printing',
      );
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
      const job = this.queue.shift();
      if (!job) continue;

      try {
        await this.printSingle(job);
        // wait between prints
        await new Promise((r) => setTimeout(r, 3000));
      } catch (error: any) {
        console.error(
          `❌ Print error for order ${job.orderId}:`,
          error?.message || error,
        );
      }
    }

    this.isPrinting = false;
    console.log('🕓 All queued prints completed');
  }

  private async printSingle(job: PrintJob): Promise<void> {
    const { orderId, tspl } = job;

    if (!existsSync(this.printerPath)) {
      throw new Error(`Printer not connected at ${this.printerPath}`);
    }

    try {
      await writeFile(this.printerPath, Buffer.from(tspl, 'utf8'));
      console.log(`✅ Printed order: ${orderId}`);
    } catch (err) {
      console.error(`Write to printer failed (${this.printerPath}):`, err);
      throw err;
    }
  }

  private buildTsplForOrder(order: OrderEntity): string {
    const customerName = order.customer?.name || '';
    const customerPhone = order.customer?.phone_number || '';
    const orderPrice =
      Number(order.total_price || 0).toLocaleString('en-US') + " so'm";
    const qrCode = order.qr_code_token || '';
    const district = order.customer?.district?.name || '';
    const address = order.customer?.address || '';
    const market = order.market?.name || '';
    const comment = order.comment || '';

    return `
SIZE 100 mm,60 mm
GAP 2 mm,0 mm
CLS

TEXT 325,20,"4",0,1,1,"Beepost"

TEXT 20,80,"4",0,1,1,"${customerName.length > 20 ? customerName.slice(0, 19) + '...' : customerName}"
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
  }

  getQueueStatus() {
    return {
      pending: this.queue.length,
      isPrinting: this.isPrinting,
    };
  }
}
