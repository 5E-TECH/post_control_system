import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
} from '@nestjs/common';
import { MarketService } from './market.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { LoginMarketDto } from './dto/login-market.dto';
import { Response } from 'express';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Post()
  create(@Body() createMarketDto: CreateMarketDto) {
    return this.marketService.createMarket(createMarketDto);
  }

  @Get()
  findAll() {
    return this.marketService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMarketDto: UpdateMarketDto) {
    return this.marketService.update(id, updateMarketDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketService.remove(id);
  }

  @Post('login')
  loginMarket(
    @Body() loginMarketDto: LoginMarketDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.marketService.marketLogin(loginMarketDto, res);
  }
}
