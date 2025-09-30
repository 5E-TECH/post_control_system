import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CashboxHistoryService } from './cashbox-history.service';
import { CreateCashboxHistoryDto } from './dto/create-cashbox-history.dto';
import { UpdateCashboxHistoryDto } from './dto/update-cashbox-history.dto';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Cashbox History')
@Controller('cashbox-history')
export class CashboxHistoryController {
  constructor(private readonly cashboxHistoryService: CashboxHistoryService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.COURIER, Roles.MARKET)
  @Post()
  create(@Body() createCashboxHistoryDto: CreateCashboxHistoryDto) {
    return this.cashboxHistoryService.create(createCashboxHistoryDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get()
  findAll() {
    return this.cashboxHistoryService.findAll();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.COURIER, Roles.MARKET)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cashboxHistoryService.findOne(id);
  }
}
