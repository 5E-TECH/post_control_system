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

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('main')
  getMainCashbox() {
    return this.cashBoxService.getMainCashbox();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('user/:id')
  cashboxByUserId(@Param('id') id: string) {
    return this.cashBoxService.getCashboxByUserId(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER, Roles.MARKET)
  @Get('my-cashbox')
  myCashbox(@CurrentUser() user: JwtPayload) {
    return this.cashBoxService.myCashbox(user);
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

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get('all-info')
  allCashboxesInfo() {
    return this.cashBoxService.allCashboxesTotal();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('financial-balanse')
  finacialBalance() {
    return this.cashBoxService.financialBalance();
  }
}
