import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @ApiOperation({ summary: 'Find cashbox history list' })
  @ApiResponse({ status: 200, description: 'Cashbox history list' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get('history')
  getAllHistory() {
    return this.financeService.getAllHistory();
  }

  @ApiOperation({ summary: 'Find cashbox history detail by id' })
  @ApiParam({ name: 'id', description: 'Cashbox history ID' })
  @ApiResponse({ status: 200, description: 'Cashbox history detail' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.COURIER, Roles.MARKET)
  @Get('history/:id')
  getHistoryById(@Param('id') id: string) {
    return this.financeService.getHistoryById(id);
  }
}
