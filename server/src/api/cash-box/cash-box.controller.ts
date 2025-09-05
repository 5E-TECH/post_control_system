import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CashBoxService } from './cash-box.service';
import { UpdateCashBoxDto } from './dto/update-cash-box.dto';

@Controller('cashe-box')
export class CasheBoxController {
  constructor(private readonly casheBoxService: CashBoxService) {}

  @Get()
  getBalance(){
    return this.casheBoxService.findAll()
  }

  @Patch(':id')
  updateBalance(@Param('id') id:string, @Body() updateCasheBoxDto: UpdateCashBoxDto){
    return this.casheBoxService.update(id, updateCasheBoxDto)
  }

}
