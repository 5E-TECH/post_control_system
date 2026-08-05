import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvestorLedgerService } from './investor-ledger.service';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import {
  RecordCapitalDto,
  RecordDistributionDto,
  RecordWithdrawalDto,
  SetOwnershipDto,
} from './dto/ledger.dto';

/**
 * Admin equity boshqaruvi — investorlarning kapital/ulush/taqsimotini kiritish.
 * FAQAT SUPERADMIN/ADMIN. Har yozuv activity-log'ga tushadi (servis ichida).
 */
@ApiTags('Investor Admin')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
@Controller('investor-admin')
export class InvestorAdminController {
  constructor(private readonly ledgerService: InvestorLedgerService) {}

  @Get('list')
  @ApiOperation({ summary: 'Barcha investorlar ro\'yxati' })
  list() {
    return this.ledgerService.listInvestors();
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Investor equity xulosasi (admin ko\'rinishi)' })
  summary(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ledgerService.getSummary(id, startDate, endDate);
  }

  @Get(':id/ledger')
  @ApiOperation({ summary: 'Investor ledger tarixi (admin)' })
  ledger(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledgerService.listEntries(
      id,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Post(':id/capital')
  @ApiOperation({ summary: 'Kapital hissasini yozish' })
  capital(
    @Param('id') id: string,
    @Body() dto: RecordCapitalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerService.recordCapital(id, dto, user);
  }

  @Post(':id/ownership')
  @ApiOperation({ summary: 'Egalik ulushini o\'rnatish / o\'zgartirish' })
  ownership(
    @Param('id') id: string,
    @Body() dto: SetOwnershipDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerService.setOwnership(id, dto, user);
  }

  @Post(':id/distribution')
  @ApiOperation({ summary: 'To\'langan taqsimotni yozish (foyda dividendi)' })
  distribution(
    @Param('id') id: string,
    @Body() dto: RecordDistributionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerService.recordDistribution(id, dto, user);
  }

  @Post(':id/capital-withdrawal')
  @ApiOperation({ summary: 'Tikkan kapitaldan qaytarib berish (dividend EMAS)' })
  capitalWithdrawal(
    @Param('id') id: string,
    @Body() dto: RecordWithdrawalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerService.recordWithdrawal(id, dto, user);
  }
}
