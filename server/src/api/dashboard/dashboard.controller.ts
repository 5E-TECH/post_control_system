import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO string)',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getOverview({ startDate, endDate });
  }

  @Get('overview/courier')
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO string)',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  getStatsForCourier(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getStatsForCourier(user, {
      startDate,
      endDate,
    });
  }

  @Get('overview/market')
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO string)',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  getStatsForMarket(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getStatsForMarket(user, {
      startDate,
      endDate,
    });
  }
}
