import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AiFinanceService } from './ai-finance.service';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Financial AI')
@ApiBearerAuth()
@Controller('financial-ai')
export class AiFinanceController {
  constructor(private readonly aiFinance: AiFinanceService) {}

  // Faqat superadmin/admin — ichki analitik asbob (fail-closed RolesGuard).
  @ApiOperation({
    summary: 'AI xarajat hisoboti (kunlik/haftalik/oylik/yillik)',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
  })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('expense-report')
  expenseReport(
    @Query('period') period?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.aiFinance.getExpenseReport(period, fromDate, toDate);
  }
}
