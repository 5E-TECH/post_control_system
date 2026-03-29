import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrinterService } from './printer.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';

@ApiTags('Printer')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR, Roles.MARKET, Roles.OPERATOR)
@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post('print')
  async printLabel(@Body() printOrderDto: CreatePrinterDto) {
    return await this.printerService.generateReceiptHtml(printOrderDto);
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
