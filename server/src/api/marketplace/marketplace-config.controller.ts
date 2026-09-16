import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Roles } from 'src/common/enums';
import { MarketplaceConfigService } from './marketplace-config.service';
import {
  CreateMarketplaceDto,
  SetMarketplaceActiveDto,
  SetMarketplaceTariffDto,
  UpdateMarketplaceDto,
} from './dto';

/**
 * MARKETPLACE SOZLASH — faqat admin.
 *
 * ⚠️ Nega ALOHIDA controller (operator controlleriga qo'shilmagan):
 * `MarketplaceController` da `REGISTRATOR` ham bor — u skan qilishi SHART.
 * Lekin registrator kalit aylantirishi, tarif o'zgartirishi yoki ulanishni
 * o'chirishi MUMKIN EMAS. Rollar bitta controllerda aralashsa, keyinchalik
 * yangi route qo'shganda noto'g'ri `@AcceptRoles` nusxalanishi juda oson.
 *
 * ⚠️ Modulda bu controller `MarketplaceController` DAN OLDIN ro'yxatga
 * olinadi: `marketplace/config/:slug` ni `marketplace/:slug/...` shabloni
 * ushlab qolmasin.
 */
@ApiTags('Marketplace — sozlash')
@ApiBearerAuth()
@Controller('marketplace/config')
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
export class MarketplaceConfigController {
  constructor(private readonly config: MarketplaceConfigService) {}

  @Get()
  @ApiOperation({ summary: "Ulanishlar ro'yxati (sekretlarsiz)" })
  list() {
    return this.config.list();
  }

  @Post()
  @ApiOperation({ summary: "Yangi ulanish — O'CHIQ holda yaratiladi" })
  create(@Body() dto: CreateMarketplaceDto, @CurrentUser() user: JwtPayload) {
    return this.config.create(dto, user);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Bitta ulanish + sozlash checklisti' })
  get(@Param('slug') slug: string) {
    return this.config.getBySlug(slug);
  }

  @Get(':slug/health')
  @ApiOperation({ summary: 'Tayyorlik + daftar invarianti' })
  health(@Param('slug') slug: string) {
    return this.config.health(slug);
  }

  @Patch(':slug')
  @ApiOperation({ summary: "Tahrirlash (slug va market o'zgarmaydi)" })
  update(@Param('slug') slug: string, @Body() dto: UpdateMarketplaceDto) {
    return this.config.update(slug, dto);
  }

  @Post(':slug/active')
  @ApiOperation({ summary: 'MASTER kalit — yoqish/o\'chirish' })
  setActive(
    @Param('slug') slug: string,
    @Body() dto: SetMarketplaceActiveDto,
  ) {
    return this.config.setActive(slug, dto.is_active);
  }

  @Post(':slug/test')
  @ApiOperation({ summary: 'Ulanishni tekshirish (ping)' })
  test(@Param('slug') slug: string) {
    return this.config.testConnection(slug);
  }

  // ─────────────── tarif ───────────────

  @Get(':slug/tariff')
  @ApiOperation({ summary: 'Tarif tarixi (versiyalar)' })
  tariffHistory(@Param('slug') slug: string) {
    return this.config.tariffHistory(slug);
  }

  @Post(':slug/tariff')
  @ApiOperation({
    summary: "Yangi tarif versiyasi — yo'ldagi posilkalarga ta'sir qilmaydi",
  })
  setTariff(
    @Param('slug') slug: string,
    @Body() dto: SetMarketplaceTariffDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.config.setTariff(slug, dto, user);
  }

  // ─────────────── sekretlar ───────────────
  // ⚠️ Faqat SUPERADMIN: kalit aylantirish noto'g'ri paytda qilinsa
  // integratsiyani to'xtatib qo'yadi.

  @Post(':slug/secret/signing/rotate')
  @AcceptRoles(Roles.SUPERADMIN)
  @ApiOperation({
    summary: "Imzo sekretini aylantirish — yangi qiymat BIR MARTA qaytadi",
  })
  rotateSigning(@Param('slug') slug: string) {
    return this.config.rotateSigningSecret(slug);
  }

  @Post(':slug/secret/signing/clear-previous')
  @AcceptRoles(Roles.SUPERADMIN)
  @ApiOperation({ summary: 'Eski imzo sekretini tozalash (aylantirish tugagach)' })
  clearPrevious(@Param('slug') slug: string) {
    return this.config.clearPreviousSecret(slug);
  }

  @Post(':slug/secret/inbound/rotate')
  @AcceptRoles(Roles.SUPERADMIN)
  @ApiOperation({ summary: 'Kiruvchi API kalitni aylantirish' })
  rotateInbound(@Param('slug') slug: string) {
    return this.config.rotateInboundKey(slug);
  }
}
