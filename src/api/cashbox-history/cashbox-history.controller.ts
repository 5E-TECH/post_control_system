import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CashboxHistoryService } from './cashbox-history.service';
import { CreateCashboxHistoryDto } from './dto/create-cashbox-history.dto';
import { UpdateCashboxHistoryDto } from './dto/update-cashbox-history.dto';

@Controller('cashbox-history')
export class CashboxHistoryController {
  constructor(private readonly cashboxHistoryService: CashboxHistoryService) {}

  @Post()
  create(@Body() createCashboxHistoryDto: CreateCashboxHistoryDto) {
    return this.cashboxHistoryService.create(createCashboxHistoryDto);
  }

  @Get()
  findAll() {
    return this.cashboxHistoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cashboxHistoryService.findOne(id);
  }
}
