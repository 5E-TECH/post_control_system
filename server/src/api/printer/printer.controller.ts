import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PrinterService } from './printer.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';

@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post('print')
  async printLabel(@Body() printOrderDto: CreatePrinterDto) {
    return await this.printerService.printMultiple(printOrderDto);
  }

  // @Post('print:token')
  // async printSingleLabel(@Param('token') token: string) {
  //   return await this.printerService.printLabel(token);
  // }
}
