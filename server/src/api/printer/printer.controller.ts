import {
  Controller,
  Post,
  Body,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { PrinterService } from './printer.service';
import { CreatePrinterDto } from './dto/create-printer.dto';

@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post('print')
  async printLabel(@Body() printOrderDto: CreatePrinterDto) {
    return await this.printerService.printMultiple(printOrderDto);
  }

  @Post('receipt')
  async getReceipt(@Body() printOrderDto: CreatePrinterDto) {
    return await this.printerService.generateReceiptHtml(printOrderDto);
  }

  @Post('thermal-pdf')
  async getThermalPdf(
    @Body() printOrderDto: CreatePrinterDto,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.printerService.generateThermalReceiptPdf(printOrderDto);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="beepost-chek-${Date.now()}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
