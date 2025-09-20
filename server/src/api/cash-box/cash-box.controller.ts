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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
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

@ApiTags('Cash Box')
@ApiBearerAuth()
@Controller('cashbox')
export class CasheBoxController {
  constructor(private readonly cashBoxService: CashBoxService) {}

  @ApiOperation({ summary: 'Get main cashbox summary' })
  @ApiResponse({ status: 200, description: 'Main cashbox info' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('main')
  getMainCashbox() {
    return this.cashBoxService.getMainCashbox();
  }

  @ApiOperation({ summary: 'Get cashbox by user ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Cashbox info for user' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('user/:id')
  cashboxByUserId(@Param('id') id: string) {
    return this.cashBoxService.getCashboxByUserId(id);
  }

  @ApiOperation({ summary: 'Get my cashbox (courier/market)' })
  @ApiResponse({ status: 200, description: 'Own cashbox info' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER, Roles.MARKET)
  @Get('my-cashbox')
  myCashbox(@CurrentUser() user: JwtPayload) {
    return this.cashBoxService.myCashbox(user);
  }

  @ApiOperation({ summary: 'Accept payment from courier' })
  @ApiBody({ type: CreatePaymentsFromCourierDto })
  @ApiResponse({ status: 201, description: 'Payment from courier recorded' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('payment/courier')
  paymentFromCourier(
    @CurrentUser() user: JwtPayload,
    @Body() paymentFromCourierDto: CreatePaymentsFromCourierDto,
  ) {
    return this.cashBoxService.paymentsFromCourier(user, paymentFromCourierDto);
  }

  @ApiOperation({ summary: 'Payment to market' })
  @ApiBody({ type: PaymentsToMarketDto })
  @ApiResponse({ status: 201, description: 'Payment to market recorded' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('payment/market')
  paymentToMarket(
    @CurrentUser() user: JwtPayload,
    @Body() paymentToMarketDto: PaymentsToMarketDto,
  ) {
    return this.cashBoxService.paymentsToMarket(user, paymentToMarketDto);
  }

  @ApiOperation({ summary: 'Get all cashboxes total info' })
  @ApiResponse({ status: 200, description: 'Totals and aggregates' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get('all-info')
  allCashboxesInfo() {
    return this.cashBoxService.allCashboxesTotal();
  }

  @ApiOperation({ summary: 'Get financial balance' })
  @ApiResponse({ status: 200, description: 'Financial balance info' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('financial-balanse')
  finacialBalance() {
    return this.cashBoxService.financialBalance();
  }

  @ApiOperation({ summary: 'Spend money' })
  @ApiResponse({ status: 200, description: 'Spend money' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Patch('spend')
  spendMoney(
    @CurrentUser() user: JwtPayload,
    @Body() updateCashboxDto: UpdateCashBoxDto,
  ) {
    return this.cashBoxService.spendMoney(user, updateCashboxDto);
  }
}
