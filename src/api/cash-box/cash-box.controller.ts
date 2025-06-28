import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CasheBoxService } from './cash-box.service';
import { CreateCasheBoxDto } from './dto/create-cashe-box.dto';
import { UpdateCasheBoxDto } from './dto/update-cashe-box.dto';

@Controller('cashe-box')
export class CasheBoxController {
  constructor(private readonly casheBoxService: CasheBoxService) {}

  @Get()
  getBalance(){
    return this.casheBoxService.findAll()
  }

  @Patch(':id')
  updateBalance(@Param('id') id:string, @Body() updateCasheBoxDto: UpdateCasheBoxDto){
    return this.casheBoxService.update(id, updateCasheBoxDto)
  }

}
