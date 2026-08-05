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
 * Admin equity boshqaruvi.
 *
 * RBAC (ega qaroriga ko'ra):
 *   • O'qish (list/summary/ledger) — SUPERADMIN + ADMIN
 *   • FOYDA taqsimoti (dividend) — SUPERADMIN + ADMIN
 *   • Kapital belgilash/o'zgartirish/qaytarish, ULUSH o'rnatish (kamaytirish/
 *     ko'paytirish/yopish) — FAQAT SUPERADMIN
 *
 * Class-level default = SUPERADMIN+ADMIN; superadmin-only endpointlar
 * method-level @AcceptRoles(SUPERADMIN) bilan override qilinadi.
 * Har yozuv activity-log'ga tushadi (servis ichida).
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

  // FAQAT SUPERADMIN — kapital belgilash.
  @Post(':id/capital')
  @AcceptRoles(Roles.SUPERADMIN)
  @ApiOperation({ summary: 'Kapital hissasini yozish (faqat SuperAdmin)' })
  capital(
    @Param('id') id: string,
    @Body() dto: RecordCapitalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerService.recordCapital(id, dto, user);
  }

  // FAQAT SUPERADMIN — ulush o'rnatish (kamaytirish/ko'paytirish/yopish).
  @Post(':id/ownership')
  @AcceptRoles(Roles.SUPERADMIN)
  @ApiOperation({ summary: 'Egalik ulushini o\'rnatish/o\'zgartirish (faqat SuperAdmin)' })
  ownership(
    @Param('id') id: string,
    @Body() dto: SetOwnershipDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerService.setOwnership(id, dto, user);
  }

  // SUPERADMIN + ADMIN — foyda taqsimoti (dividend).
  @Post(':id/distribution')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'To\'langan taqsimotni yozish (foyda dividendi)' })
  distribution(
    @Param('id') id: string,
    @Body() dto: RecordDistributionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerService.recordDistribution(id, dto, user);
  }

  // FAQAT SUPERADMIN — tikkan kapitaldan qaytarib berish.
  @Post(':id/capital-withdrawal')
  @AcceptRoles(Roles.SUPERADMIN)
  @ApiOperation({ summary: 'Tikkan kapitaldan qaytarib berish (faqat SuperAdmin)' })
  capitalWithdrawal(
    @Param('id') id: string,
    @Body() dto: RecordWithdrawalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerService.recordWithdrawal(id, dto, user);
  }
}
