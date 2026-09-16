import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Roles } from 'src/common/enums';
import { MarketplaceScanService } from './marketplace-scan.service';
import { MarketplaceIntakeService } from './marketplace-intake.service';
import {
  AcceptParcelsDto,
  RejectParcelDto,
  ScanParcelDto,
  SettlementPayDto,
} from './dto';
import { MarketplaceSettlementService } from './marketplace-settlement.service';
import { MarketplaceLedgerService } from './marketplace-ledger.service';
import { MarketplaceReconcileService } from './marketplace-reconcile.service';
import { MarketplaceConfigService } from './marketplace-config.service';

/**
 * MARKETPLACE QABUL OQIMI — operator ekrani uchun.
 *
 * ⚠️ Bu route'lar ICHKI (bizning operator uchun). Marketplace'ning O'ZI
 * chaqiradigan o'qish endpointlari alohida controllerda bo'ladi va
 * `X-Api-Key` bilan himoyalanadi (qaror O5: ular faqat o'qiydi).
 */
@ApiTags('Marketplace')
@ApiBearerAuth()
@Controller('marketplace')
@UseGuards(JwtGuard, RolesGuard)
export class MarketplaceController {
  constructor(
    private readonly scan: MarketplaceScanService,
    private readonly intake: MarketplaceIntakeService,
    private readonly settlement: MarketplaceSettlementService,
    private readonly ledger: MarketplaceLedgerService,
    private readonly reconcile: MarketplaceReconcileService,
    private readonly config: MarketplaceConfigService,
  ) {}

  @Get('available')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @ApiOperation({
    summary: "Skan qilish mumkin bo'lgan marketplace'lar (faqat nom va slug)",
  })
  available() {
    return this.config.listForOperator();
  }

  @Post(':slug/scan-session')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @ApiOperation({ summary: 'Skan sessiyasini ochish (yoki mavjudini olish)' })
  openSession(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.scan.openSession(slug, user);
  }

  @Get('scan-session/:id')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @ApiOperation({
    summary: 'Sessiya va undagi posilkalar — sahifa yangilansa tiklash uchun',
  })
  getSession(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.scan.getSession(id, user);
  }

  @Post(':slug/scan')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @ApiOperation({
    summary: 'Bitta posilkani skanerlash — marketplace API dan tortib olinadi',
  })
  scanParcel(
    @Param('slug') slug: string,
    @Body() dto: ScanParcelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.scan.scan(slug, dto, user);
  }

  @Post('scan-session/:id/undo')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @ApiOperation({ summary: 'Oxirgi skanni sessiyadan olib tashlash' })
  undoLast(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.scan.undoLastScan(id, user);
  }

  @Post('scan-session/:id/reject')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @ApiOperation({
    summary: 'Posilkani rad etish (buzilgan, bizniki emas, hududimiz emas)',
  })
  rejectParcel(
    @Param('id') id: string,
    @Body() dto: RejectParcelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.scan.rejectParcel(id, dto.parcel_id, dto.reason, dto.note ?? null, user);
  }

  // ═══════════════════ SOLISHTIRUV VA NOMUVOFIQLIK ═══════════════════

  @Get(':slug/mismatches')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Nomuvofiqlik kartasi — hal qilinmagan posilkalar' })
  async listMismatches(@Param('slug') slug: string) {
    const integration = await this.scan.resolveIntegration(slug);
    return this.reconcile.listMismatches(integration.id);
  }

  @Post('mismatches/:parcelId/clear')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Nomuvofiqlik hal qilindi — belgini olib tashlash' })
  clearMismatch(@Param('parcelId') parcelId: string) {
    return this.reconcile.clearMismatch(parcelId);
  }

  @Post(':slug/reconcile')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Solishtiruvni QO\'LDA ishga tushirish' })
  async runReconcile(@Param('slug') slug: string) {
    const integration = await this.scan.resolveIntegration(slug);
    const parcels = await this.reconcile.reconcileParcels(integration);
    const ledger = await this.reconcile.reconcileLedger(integration);
    return { parcels, ledger };
  }

  // ═══════════════════ HISOB-KITOB ═══════════════════

  @Get(':slug/settlement/suggest')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({
    summary: "To'lov taklifi — har sotuvchining joriy qoldig'i + invariant",
  })
  suggestSettlement(@Param('slug') slug: string) {
    return this.settlement.suggestAllocation(slug);
  }

  @Post(':slug/settlement')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({
    summary: "Marketplace'ga to'lov — sotuvchilar bo'yicha taqsimot bilan",
  })
  paySettlement(
    @Param('slug') slug: string,
    @Body() dto: SettlementPayDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settlement.pay(slug, dto, user);
  }

  @Post(':slug/accept')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @ApiOperation({
    summary: 'Qabul qilish — SERVER saqlagan posilkalardan buyurtma yaratiladi',
  })
  accept(
    @Param('slug') slug: string,
    @Body() dto: AcceptParcelsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.intake.accept(slug, dto, user);
  }
}
