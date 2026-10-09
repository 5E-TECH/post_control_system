import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { Roles } from 'src/common/enums';
import type { JwtPayload } from 'src/common/utils/types/user.type';
import { successRes } from 'src/infrastructure/lib/response';
import { CourierPenaltyAdminService } from './courier-penalty-admin.service';
import {
  EntriesQueryDto,
  OverdueQueryDto,
  SummaryQueryDto,
  SetActiveDto,
  SetExemptDto,
  UpsertRuleDto,
  WaiveEntryDto,
} from './dto/courier-penalty.dto';
import { WAIVER_REASONS } from './waiver-reasons.const';

/**
 * SHTRAF MODULI — ADMIN ENDPOINTLARI.
 *
 * ⚠️ `courier-penalty/admin` PREFIKSI ATAYLAB. Kuryerning o'z sanog'i
 * `courier-penalty/my-deadlines` da va u FAQAT tokendagi id bilan
 * ishlaydi. Admin yo'llari alohida prefiksda turishi, «bu yo'l kimga
 * ochiq» degan savolni bitta qarashda hal qiladi — aks holda kuryer
 * endpointiga `?courierId=` qo'shib qo'yish eng oson va eng xavfli
 * yo'l bo'lardi.
 */
@ApiTags('Kuryer shtraf moduli — admin')
@Controller('courier-penalty/admin')
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
export class CourierPenaltyAdminController {
  constructor(private readonly service: CourierPenaltyAdminService) {}

  @ApiOperation({
    summary: 'Kechikkanlar — kuryer bo‘yicha guruhlangan',
    description:
      "Hal qilinmagan, muddati o'tgan buyurtmalar. Modulning ishlashi uchun ZARUR ekran: shtraf faqat kuryer bosganda yoziladi, umuman bosmagan kuryer esa hech narsa to'lamaydi.",
  })
  @ApiResponse({ status: 200 })
  @Get('overdue')
  async overdue(@Query() query: OverdueQueryDto) {
    return successRes(await this.service.overdue(query), 200, 'Overdue');
  }

  @ApiOperation({ summary: 'Shtraf daftari' })
  @Get('entries')
  async entries(@Query() query: EntriesQueryDto) {
    return successRes(await this.service.entries(query), 200, 'Entries');
  }

  @ApiOperation({
    summary: 'Yig‘indi — «agar yoqilganda qancha bo‘lardi»',
    description:
      "`capped_count` hal qiluvchi: ko'pchilik tarif chegarasiga ursa, bitta tekis qoida yetarli emas va kechikish darajalari kerak.",
  })
  @Get('summary')
  async summary(@Query() query: SummaryQueryDto) {
    return successRes(await this.service.summary(query), 200, 'Summary');
  }

  @ApiOperation({ summary: 'Modul kaliti (o‘qish)' })
  @Get('config')
  async config() {
    return successRes(await this.service.config(), 200, 'Config');
  }

  @ApiOperation({ summary: 'Kuryerlar — filtr va qamrov tanlovi uchun' })
  @Get('couriers')
  async couriers() {
    return successRes(await this.service.couriers(), 200, 'Couriers');
  }

  @ApiOperation({ summary: 'Bekor qilish sabablari — yopiq ro‘yxat' })
  @Get('waiver-reasons')
  waiverReasons() {
    return successRes(WAIVER_REASONS, 200, 'Waiver reasons');
  }

  @ApiOperation({ summary: 'Qoidalar ro‘yxati' })
  @Get('rules')
  async rules() {
    return successRes(await this.service.listRules(), 200, 'Rules');
  }

  @ApiOperation({ summary: 'Qoida qo‘shish' })
  @Post('rules')
  async createRule(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertRuleDto,
  ) {
    return successRes(
      await this.service.createRule(dto as never, user.id),
      201,
      'Rule created',
    );
  }

  @ApiOperation({ summary: 'Qoidani o‘zgartirish' })
  @Patch('rules/:id')
  async updateRule(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertRuleDto,
  ) {
    return successRes(
      await this.service.updateRule(id, dto as never, user),
      200,
      'Rule updated',
    );
  }

  @ApiOperation({
    summary: 'Qoidani so‘ndirish',
    description:
      "O'CHIRMAYDI — `is_active = false` qiladi. Daftar yozuvlari `rule_id` orqali qoidaga ishora qiladi; qator o'chirilsa «bu shtraf qaysi qoida bo'yicha yozilgan» degan dalil yo'qolardi.",
  })
  @Delete('rules/:id')
  async deactivateRule(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return successRes(
      await this.service.deactivateRule(id, user),
      200,
      'Rule deactivated',
    );
  }

  @ApiOperation({
    summary: 'Modulni YOQISH / O‘CHIRISH',
    description:
      "⚠️ Yoqishda `activated_at` HAR SAFAR qayta qo'yiladi — modul faqat shu paytdan KEYIN jo'natilgan buyurtmalarga tegadi. Aks holda o'chirilgan davrda jo'natilganlar qayta yoqilganda birdan shtrafga tushardi. O'chirish eski yozuvlarni QAYTARMAYDI.",
  })
  @Post('config/active')
  async setActive(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetActiveDto,
  ) {
    return successRes(
      await this.service.setActive(dto.active, user),
      200,
      dto.active ? 'Module enabled' : 'Module disabled',
    );
  }

  @ApiOperation({
    summary: 'Kuryerni shtrafdan istisno qilish / qaytarish',
    description:
      "Tashqi provayder kuryerlari kodda allaqachon istisno; bu bayroq ichki kuryerni alohida chiqarish uchun.",
  })
  @Patch('couriers/:id/exempt')
  async setExempt(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetExemptDto,
  ) {
    return successRes(
      await this.service.setExempt(id, dto.exempt, user),
      200,
      'Exemption updated',
    );
  }

  @ApiOperation({
    summary: 'Shtrafni bekor qilish',
    description:
      "Asl qator O'CHIRILMAYDI — ustiga teskari ishorali `waiver` qatori yoziladi. Sabab MAJBURIY va yopiq ro'yxatdan.",
  })
  @Post('entries/:id/waive')
  async waive(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WaiveEntryDto,
  ) {
    return successRes(
      await this.service.waive(id, dto.reason, dto.note ?? null, user.id),
      200,
      'Waived',
    );
  }
}
