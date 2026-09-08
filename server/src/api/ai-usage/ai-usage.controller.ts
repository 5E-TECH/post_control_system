import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AiUsageService } from './ai-usage.service';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

/**
 * AI dashboard — real xarajat va AI buyurtma analitikasi. Faqat superadmin/admin
 * (fail-closed RolesGuard). O'qish-only: hech narsa yozmaydi/o'chirmaydi.
 */
@ApiTags('AI Usage')
@ApiBearerAuth()
@Controller('ai-usage')
export class AiUsageController {
  constructor(private readonly aiUsage: AiUsageService) {}

  @ApiOperation({
    summary:
      'AI dashboard agregat (xarajat USD/so\'m, feature/model, kunlik trend, AI buyurtma)',
  })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('dashboard')
  dashboard(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.aiUsage.getDashboard(fromDate, toDate);
  }

  @ApiOperation({ summary: 'AI orqali yaratilgan buyurtmalar royxati' })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('ai-orders')
  aiOrders(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.aiUsage.getAiOrders(fromDate, toDate, Number(limit) || 100);
  }
}
