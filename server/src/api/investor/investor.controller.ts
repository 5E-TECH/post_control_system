import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InvestorService } from './investor.service';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
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
  constructor(private readonly investorService: InvestorService) {}

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
}
