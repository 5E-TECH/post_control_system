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
import { CashBoxService } from './cash-box.service';
import { UpdateCashBoxDto } from './dto/update-cash-box.dto';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreatePaymentsFromCourierDto } from './dto/payments-from-courier.dto';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { PaymentsToMarketDto } from './dto/payment-to-market.dto';

@Controller('cashbox')
export class CasheBoxController {
  constructor(private readonly cashBoxService: CashBoxService) {}

  @Get()
  getBalance() {
    return this.cashBoxService.findAll();
  }

  @Patch(':id')
  updateBalance(
    @Param('id') id: string,
    @Body() updateCasheBoxDto: UpdateCashBoxDto,
  ) {
    return this.cashBoxService.update(id, updateCasheBoxDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('user/:id')
  cashboxByUserId(@Param('id') id: string) {
    return this.cashBoxService.getCashboxByUserId(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('payment/courier')
  paymentFromCourier(
    @CurrentUser() user: JwtPayload,
    @Body() paymentFromCourierDto: CreatePaymentsFromCourierDto,
  ) {
    return this.cashBoxService.paymentsFromCourier(user, paymentFromCourierDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('payment/market')
  paymentToMarket(
    @CurrentUser() user: JwtPayload,
    @Body() paymentToMarketDto: PaymentsToMarketDto,
  ) {
    return this.cashBoxService.paymentsToMarket(user, paymentToMarketDto);
  }
}
