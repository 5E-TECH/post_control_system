import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { MarketHandoverService } from './market-handover.service';
import {
  AwaitingQueryDto,
  CompleteHandoverDto,
  HandoverHistoryQueryDto,
  HandoverConsentFlagDto,
  HandoverSessionTokenDto,
  OfflineHandoverDto,
  ScanHandoverDto,
} from './dto/market-handover.dto';

/**
 * BEKOR QAYTARISHNI MARKETGA TOPSHIRISH.
 *
 * Oqim:
 *   market  → POST consent              (QR + PIN, 2 daqiqa)
 *   xodim   → POST scan                 (ruxsat, 10 daqiqa)
 *   xodim   → POST heartbeat            (har 30 s, sahifa tirik)
 *   xodim   → POST complete  × N        (partiya-partiya topshirish)
 *   xodim   → POST finish | release     (yakunlash / sahifadan chiqish)
 *
 * ⚠️ Har handlerda `@AcceptRoles` BOR bo'lishi shart — `RolesGuard`
 * fail-closed va `npm run audit:roles` (deploy darvozasi) rolsiz handlerni
 * topib CI'ni to'xtatadi.
 */
@ApiTags('Market handover (bekor qaytarish)')
@ApiBearerAuth()
@Controller('market-handover')
export class MarketHandoverController {
  constructor(private readonly service: MarketHandoverService) {}

  // ════════════════════════════ MARKET ════════════════════════════

  @ApiOperation({
    summary: 'Market: topshirishga ruxsat berish (QR + PIN yaratish)',
    description:
      '⚠️ `market_id` TOKENDAN olinadi — market faqat O‘ZI uchun ruxsat ' +
      'yarata oladi. QR 2 daqiqa amal qiladi; oldingi ishlatilmagan ruxsat ' +
      'bekor qilinadi.',
  })
  @ApiResponse({ status: 201, description: 'QR token + PIN' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Post('consent')
  createConsent(@CurrentUser() user: JwtPayload) {
    return this.service.createConsent(user);
  }

  @ApiOperation({
    summary: 'Market: ruxsatimning holati',
    description:
      'QR/PIN BIR MARTALIK: xodim skanerlashi bilan eski kod o‘ladi. Market ' +
      'modali shu yo‘lni so‘rab turadi va holat o‘zgarsa ekranni almashtiradi ' +
      '(`waiting` / `expired` / `handover` / `done`). Javobda token/PIN YO‘Q.',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('consent/status')
  consentStatus(@CurrentUser() user: JwtPayload) {
    return this.service.consentStatus(user);
  }

  @ApiOperation({ summary: 'Market: markazda turgan qaytarishlarim' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET, Roles.OPERATOR)
  @Get('my/returns')
  listForMarket(
    @Query() query: AwaitingQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listForMarket(user, query);
  }

  @ApiOperation({ summary: 'Market: kutayotgan qaytarishlar soni (badge)' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET, Roles.OPERATOR)
  @Get('my/returns/counts')
  countsForMarket(@CurrentUser() user: JwtPayload) {
    return this.service.countsForMarket(user);
  }

  @ApiOperation({
    summary: 'Market: men olgan qaytarishlar (partiya bo‘yicha)',
    description:
      'Topshirilgan posilkalar PARTIYA bo‘yicha guruhlanadi — xuddi ' +
      '«topshirilgan pochta» kabi. Market omborga bir keladi va o‘nlab ' +
      'posilkani birga olib ketadi; yassi ro‘yxat bu faktni yo‘qotadi. ' +
      '`market_id` TOKENDAN olinadi (IDOR himoyasi).',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET, Roles.OPERATOR)
  @Get('my/handovers')
  listMyHandovers(
    @Query() query: HandoverHistoryQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listMyHandovers(user, query);
  }

  // ════════════════════════════ XODIM ════════════════════════════

  @ApiOperation({
    summary: 'Xodim: market QR‘ini skanerlash yoki PIN kiritish',
    description:
      'Natija — 10 daqiqalik topshirish ruxsati, AYNAN skanerlagan xodimga ' +
      'tegishli. PIN yo‘lida `market_id` majburiy.',
  })
  @ApiBody({ type: ScanHandoverDto })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('scan')
  scan(@Body() dto: ScanHandoverDto, @CurrentUser() user: JwtPayload) {
    return this.service.scan(dto, user);
  }

  @ApiOperation({
    summary: 'Xodim: topshirish sahifasi tirik (heartbeat)',
    description:
      'Sahifa har 30 s da yuboradi. 60 s dan uzoq jimlik = brauzer qulagan ' +
      'yoki tarmoq uzilgan → ruxsat o‘ladi.',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('heartbeat')
  heartbeat(
    @Body() dto: HandoverSessionTokenDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.heartbeat(dto.authorization_token, user);
  }

  @ApiOperation({
    summary: 'Xodim: posilkalarni marketga topshirish (partiya)',
    description:
      'Ruxsat oynasi ichida KO‘P MARTA chaqirilishi mumkin. Tanlangan ' +
      'ro‘yxatdagi birorta qator shartga mos kelmasa — BUTUN partiya rad ' +
      'etiladi (qisman bajarilmaydi).',
  })
  @ApiBody({ type: CompleteHandoverDto })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('complete')
  complete(@Body() dto: CompleteHandoverDto, @CurrentUser() user: JwtPayload) {
    return this.service.complete(dto, user);
  }

  @ApiOperation({ summary: 'Xodim: topshirishni yakunlash' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('finish')
  finish(
    @Body() dto: HandoverSessionTokenDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.release(dto.authorization_token, user, true);
  }

  @ApiOperation({
    summary: 'Xodim: sahifadan chiqildi — ruxsatni yopish',
    description:
      'Sahifa yopilganda `sendBeacon` bilan yuboriladi, shuning uchun ' +
      'IDEMPOTENT: allaqachon yopilgan ruxsat uchun ham 200 qaytaradi.',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('release')
  release(
    @Body() dto: HandoverSessionTokenDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.release(dto.authorization_token, user, false);
  }

  @ApiOperation({
    summary: 'Xodim: «Markazda — market kutilmoqda» navbati',
    description:
      'MARKET bo‘yicha guruhlangan: dona, summa, eng keksa posilkaning ' +
      'yoshi, eskalatsiya soni. Eng uzoq kutayotgan market birinchi.',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.LOGIST)
  @Get('awaiting')
  listAwaiting(@Query() query: AwaitingQueryDto) {
    return this.service.listAwaitingByMarket(query);
  }

  @ApiOperation({
    summary: 'Xodim: bitta marketning topshirishga tayyor posilkalari',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.LOGIST)
  @Get('awaiting/:marketId')
  listAwaitingOrders(
    @Param('marketId', ParseUUIDPipe) marketId: string,
    @Query() query: AwaitingQueryDto,
  ) {
    return this.service.listAwaitingOrdersOfMarket(marketId, query);
  }

  @ApiOperation({
    summary: 'Xodim: topshirilgan qaytarishlar tarixi (partiya bo‘yicha)',
    description:
      'Sana oralig‘i va market bo‘yicha filtrlanadi. Sana `YYYY-MM-DD` ' +
      'SATR — Toshkent kuni (epoch EMAS), pochta ro‘yxati bilan ayni.',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.LOGIST)
  @Get('handovers')
  listHandovers(@Query() query: HandoverHistoryQueryDto) {
    return this.service.listHandovers(query);
  }

  @ApiOperation({
    summary: 'Partiya tarkibi — topshirilgan posilkalar + MAHSULOTLARI',
    description:
      'Market faqat O‘Z partiyasini ocha oladi (`market_id` tokendan ' +
      'WHERE shartiga qo‘shiladi — IDOR himoyasi).',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(
    Roles.SUPERADMIN,
    Roles.ADMIN,
    Roles.REGISTRATOR,
    Roles.LOGIST,
    Roles.MARKET,
    Roles.OPERATOR,
  )
  @Get('handovers/:sessionId')
  handoverBatch(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.handoverBatchOrders(sessionId, user);
  }

  @ApiOperation({
    summary: 'Eskirish hisoboti — navbat yoshi va yopish rejimlari',
    description:
      'Yosh bucketlari (0-3 / 3-7 / 7-14 / 14+ kun) va oxirgi 30 kunda ' +
      'posilkalar qanday yopilgani. `market_consent_rate_30d` past bo‘lsa ' +
      'darvoza amalda ishlamayapti (hammasi offline akt bilan yopilyapti).',
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get('report/aging')
  agingReport() {
    return this.service.agingReport();
  }

  // ════════════════════════════ ADMIN ════════════════════════════

  @ApiOperation({
    summary: 'Offline akt bilan topshirish (market QR‘siz)',
    description:
      'Market panelga kira olmaganda. Vakil ismi, telefoni va sabab ' +
      'MAJBURIY. Ruxsat majburiy qilingan marketda registrator ishlatolmaydi.',
  })
  @ApiBody({ type: OfflineHandoverDto })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Post('offline')
  offline(@Body() dto: OfflineHandoverDto, @CurrentUser() user: JwtPayload) {
    return this.service.offlineHandover(dto, user);
  }

  @ApiOperation({
    summary: 'Admin: market uchun ruxsat majburiyligini sozlash',
    description:
      'Default `false` — ruxsat qayd etiladi, lekin bloklamaydi. Market ' +
      'onboarding‘dan o‘tgach `true` qilinadi.',
  })
  @ApiBody({ type: HandoverConsentFlagDto })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Patch('markets/:marketId/consent-required')
  setConsentRequired(
    @Param('marketId', ParseUUIDPipe) marketId: string,
    @Body() dto: HandoverConsentFlagDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.setConsentRequired(
      marketId,
      dto.cancel_handover_consent_required,
      user,
    );
  }
}
