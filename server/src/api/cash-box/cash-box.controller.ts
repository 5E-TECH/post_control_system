import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CashBoxService } from './cash-box.service';
import { UpdateCashBoxDto } from './dto/update-cash-box.dto';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import {
  Cashbox_type,
  Operation_type,
  Roles,
  Source_type,
} from 'src/common/enums';
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
  getMainCashbox(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.cashBoxService.getMainCashbox({ fromDate, toDate });
  }

  @ApiOperation({ summary: 'Export main cashbox to Excel' })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file downloaded',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('main/export')
  async exportMainCashbox(
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const buffer = await this.cashBoxService.exportMainCashboxToExcel({
      fromDate,
      toDate,
    });

    const filename = `cashbox-${fromDate || 'daily'}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Get cashbox by user ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Cashbox info for user' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('user/:id')
  cashboxByUserId(
    @Param('id') id: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.cashBoxService.getCashboxByUserId(id, { fromDate, toDate });
  }

  @ApiOperation({ summary: 'Get my cashbox (courier/market)' })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Own cashbox info' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER, Roles.MARKET)
  @Get('my-cashbox')
  myCashbox(
    @CurrentUser() user: JwtPayload,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.cashBoxService.myCashbox(user, { fromDate, toDate });
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
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Totals and aggregates with pagination',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get('all-info')
  allCashboxesInfo(
    @Query('operationType') operationType?: Operation_type,
    @Query('sourceType') sourceType?: Source_type,
    @Query('createdBy') createdBy?: string,
    @Query('cashboxType') cashboxType?: Cashbox_type,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.cashBoxService.allCashboxesTotal({
      operationType,
      sourceType,
      createdBy,
      cashboxType,
      fromDate,
      toDate,
      page,
      limit,
    });
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

  @ApiOperation({ summary: 'Fill cahshbox' })
  @ApiResponse({ status: 200, description: 'Fill cashbox' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Patch('fill')
  fillCashbox(
    @CurrentUser() user: JwtPayload,
    @Body() updateCashboxDto: UpdateCashBoxDto,
  ) {
    return this.cashBoxService.fillTheCashbox(user, updateCashboxDto);
  }

  // ==================== SHIFT (SMENA) ENDPOINTS ====================

  @ApiOperation({ summary: 'Get current open shift' })
  @ApiResponse({ status: 200, description: 'Current shift info' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('shift/current')
  getCurrentShift() {
    return this.cashBoxService.getCurrentShift();
  }

  @ApiOperation({ summary: 'Open a new shift' })
  @ApiResponse({ status: 201, description: 'Shift opened' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('shift/open')
  openShift(@CurrentUser() user: JwtPayload) {
    return this.cashBoxService.openShift(user);
  }

  @ApiOperation({ summary: 'Close current shift' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        comment: { type: 'string', description: 'Optional comment for shift' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Shift closed with report data' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('shift/close')
  closeShift(
    @CurrentUser() user: JwtPayload,
    @Body('comment') comment?: string,
  ) {
    return this.cashBoxService.closeShift(user, comment);
  }

  @ApiOperation({ summary: 'Export shift report to Excel' })
  @ApiQuery({
    name: 'shiftId',
    required: false,
    type: String,
    description: 'Shift ID (defaults to last closed shift)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file downloaded',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('shift/export')
  async exportShift(
    @Res() res: Response,
    @Query('shiftId') shiftId?: string,
  ) {
    const buffer = await this.cashBoxService.exportShiftToExcel(shiftId);

    const filename = `smena-hisobot-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Get shift history' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({ status: 200, description: 'List of shifts' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('shift/history')
  getShiftHistory(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.cashBoxService.getShiftHistory({ page, limit });
  }
}
