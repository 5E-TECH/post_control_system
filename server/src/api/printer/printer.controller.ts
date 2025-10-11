// src/printer/printer.controller.ts
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { promises as fsPromises } from 'fs';
import { existsSync } from 'fs';

@Controller('printer')
export class PrinterController {
  private readonly printerPath = '/dev/usb/lp0';

  @Get('status')
  status() {
    return {
      printerPath: this.printerPath,
      exists: existsSync(this.printerPath),
    };
  }

  @Post('raw')
  async rawPrint(@Body() body: { tspl?: string }) {
    const { tspl } = body;
    if (!tspl) throw new BadRequestException('tspl missing');
    if (!existsSync(this.printerPath))
      throw new BadRequestException('Printer not connected');

    try {
      await fsPromises.writeFile(this.printerPath, Buffer.from(tspl, 'utf8'));
      return { ok: true, printedBytes: tspl.length };
    } catch (err) {
      console.error('rawPrint failed:', err);
      throw err;
    }
  }
}
