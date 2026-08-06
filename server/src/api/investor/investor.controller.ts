import { Controller, Get, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InvestorService } from './investor.service';
import { InvestorLedgerService } from './investor-ledger.service';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { LogInvestorAccess } from 'src/common/decorator/log-investor-access.decorator';
import { LogInvestorAccessInterceptor } from 'src/common/interceptors/log-investor-access.interceptor';

/**
 * Investor (ulushdor) uchun FAQAT-O'QISH aggregat surface.
 * Barcha endpoint: JwtGuard + RolesGuard(fail-closed) + @AcceptRoles(INVESTOR,
 * ADMIN, SUPERADMIN) + har kirish activity-log'ga yoziladi. Faqat GET.
 * Yozuv (write) yo'q. Har javob investor-safe map qilingan (xom entity emas).
 */
@ApiTags('Investor')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.INVESTOR, Roles.ADMIN, Roles.SUPERADMIN)
@UseInterceptors(LogInvestorAccessInterceptor)
@Controller('investor')
export class InvestorController {
  constructor(
    private readonly investorService: InvestorService,
    private readonly ledgerService: InvestorLedgerService,
  ) {}

  @Get('overview')
  @LogInvestorAccess('overview')
  @ApiOperation({ summary: 'Biznes umumiy ko\'rinishi (buyurtma statuslari + foyda)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.investorService.getOverview(startDate, endDate);
  }

  @Get('revenue')
  @LogInvestorAccess('revenue')
  @ApiOperation({ summary: 'Daromad/foyda time-series' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getRevenue(
    @Query('period') period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.investorService.getRevenue(period ?? 'daily', startDate, endDate);
  }

  @Get('order-flow')
  @LogInvestorAccess('order-flow')
  @ApiOperation({ summary: 'Buyurtma oqimi + muvaffaqiyat/qaytish darajasi' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getOrderFlow(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.investorService.getOrderFlow(startDate, endDate);
  }

  @Get('regions')
  @LogInvestorAccess('regions')
  @ApiOperation({ summary: 'Regional statistika (xarita uchun aggregat)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getRegions(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.investorService.getRegions(startDate, endDate);
  }

  @Get('leaderboards')
  @LogInvestorAccess('leaderboards')
  @ApiOperation({ summary: 'Anonim top market/kuryer reytingi (30 kun)' })
  getLeaderboards() {
    return this.investorService.getLeaderboards();
  }

  @Get('cash-position')
  @LogInvestorAccess('cash-position')
  @ApiOperation({ summary: 'Joriy sof naqd pozitsiya (nuqta-vaqt)' })
  getCashPosition() {
    return this.investorService.getCashPosition();
  }

  @Get('net-profit')
  @LogInvestorAccess('net-profit')
  @ApiOperation({ summary: 'Sof foyda P&L (gross foyda − OpEx)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getNetProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.investorService.getNetProfit(startDate, endDate);
  }

  @Get('opex')
  @LogInvestorAccess('opex')
  @ApiOperation({ summary: 'Umumiy OpEx — bitta yig\'ma raqam' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getOpEx(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.investorService.getOpEx(startDate, endDate);
  }

  @Get('unit-economics')
  @LogInvestorAccess('unit-economics')
  @ApiOperation({ summary: 'Unit-economics (buyurtmaga foyda, take-rate)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getUnitEconomics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.investorService.getUnitEconomics(startDate, endDate);
  }

  // ---- Shaxsiy equity (o'ziga scoped — req.user.id) ----
  @Get('my-investment')
  @LogInvestorAccess('my-investment')
  @ApiOperation({ summary: 'Shaxsiy investitsiya (kapital, ulush %, accrued share, ROI)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getMyInvestment(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ledgerService.getSummary(user.id, startDate, endDate);
  }

  @Get('my-investment/ledger')
  @LogInvestorAccess('my-investment-ledger')
  @ApiOperation({ summary: 'Shaxsiy ledger tarixi (kapital/taqsimot/ulush)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMyLedger(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledgerService.listEntries(
      user.id,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Get('my-investment/daily')
  @LogInvestorAccess('my-investment-daily')
  @ApiOperation({ summary: 'Shaxsiy kunlik foyda breakdown' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  getMyDaily(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ledgerService.getDailyBreakdown(user.id, startDate, endDate);
  }

  // ---- Aggregat Excel eksport ----
  @Get('export')
  @LogInvestorAccess('export')
  @ApiOperation({ summary: 'Business aggregat Excel eksport (PII yo\'q, ≤366 kun)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  async exportBusiness(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const buffer = await this.investorService.exportBusinessWorkbook(
      startDate,
      endDate,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=investor-${startDate || 'umumiy'}.xlsx`,
    );
    res.send(buffer);
  }

  @Get('my-investment/export')
  @LogInvestorAccess('my-investment-export')
  @ApiOperation({ summary: 'Shaxsiy equity Excel eksport' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  async exportMyInvestment(
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const buffer = await this.ledgerService.exportMyWorkbook(
      user.id,
      startDate,
      endDate,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=my-investment-${startDate || 'umumiy'}.xlsx`,
    );
    res.send(buffer);
  }
}
