import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AiFinanceService } from './ai-finance.service';
import { AiAskDto } from './dto/ai-finance.dto';
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

  // Qo'lda yangilash — barcha davr snapshotlarini qayta hisoblaydi (AI puli ketadi).
  @ApiOperation({ summary: "AI xarajat snapshotlarini qo'lda yangilash" })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Post('expense-report/refresh')
  refresh() {
    return this.aiFinance.refreshSnapshots();
  }

  // AI savol-javob (tool-use) — bu yerда AI puli ketadi. Throttle bilan cheklangan.
  @ApiOperation({ summary: 'Moliyaviy AI savol-javob (tabiiy til)' })
  @UseGuards(JwtGuard, RolesGuard, ThrottlerGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('ask')
  ask(@Body() dto: AiAskDto) {
    return this.aiFinance.ask(dto.question, dto.fromDate, dto.toDate);
  }
}
