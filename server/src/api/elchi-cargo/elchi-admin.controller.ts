import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Roles } from 'src/common/enums';
import { ElchiAdminService, ShipmentFilter } from './elchi-admin.service';

class AddSettlementPaymentDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  /** Epoch ms. Berilmasa — hozir. */
  @IsOptional()
  @IsNumber()
  paid_at?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * Elchi admin paneli endpointlari (`/elchi/admin/*`).
 *
 * Sozlama endpointlari `ElchiConfigController`da (`/elchi/*`) qoladi — bu
 * kontroller faqat PANEL uchun: ro'yxatlar, raqamlar va qo'lda amallar.
 * Ajratilgani ataylab: sozlama kontrolleri allaqachon katta va ikkisining
 * o'zgarish sabablari boshqa.
 */
@ApiTags('Elchi admin')
@ApiBearerAuth()
@Controller('elchi/admin')
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
export class ElchiAdminController {
  constructor(private readonly adminService: ElchiAdminService) {}

  // ===================== UMUMIY HOLAT =====================

  @ApiOperation({
    summary: 'Umumiy holat: tayyorlik checklisti + jonli raqamlar',
  })
  @Get('health')
  async health() {
    return this.adminService.getHealth();
  }

  @ApiOperation({
    summary: "Faqat raqamlar (tashqi so'rovsiz — tez-tez chaqirsa bo'ladi)",
  })
  @Get('stats')
  async stats() {
    return this.adminService.getStats();
  }

  // ===================== JO'NATMALAR =====================

  @ApiOperation({ summary: "Jo'natmalar ro'yxati (filtr + qidiruv)" })
  @Get('shipments')
  async shipments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: ShipmentFilter,
    @Query('search') search?: string,
  ) {
    return this.adminService.getShipments({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      filter,
      search,
    });
  }

  @ApiOperation({
    summary: "Nomuvofiqlikni qo'lda yopish (belgini tozalaydi, pulga tegmaydi)",
  })
  @Post('shipments/:orderId/resolve-mismatch')
  async resolveMismatch(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.resolveMismatch(orderId, user);
  }

  // ===================== WEBHOOK LOGLAR =====================

  @ApiOperation({ summary: 'Webhook jurnali (status filtri + qidiruv)' })
  @Get('webhook-logs')
  async webhookLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getWebhookLogs({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      search,
    });
  }

  @ApiOperation({
    summary:
      "Webhookni qayta ishlash. Imzosi noto'g'ri yozuvlar RAD ETILADI — " +
      'xom tana saqlanmagani uchun imzoni qayta tekshirib bo\'lmaydi.',
  })
  @Post('webhook-logs/:eventId/reprocess')
  async reprocessWebhook(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.reprocessWebhook(eventId, user);
  }

  // ===================== HISOB-KITOB =====================

  @ApiOperation({
    summary:
      "Pul solishtiruvi: davr harakati + butun vaqt qoldig'i (qarz). " +
      "`from`/`to` — epoch ms.",
  })
  @Get('settlement')
  async settlement(@Query('from') from?: string, @Query('to') to?: string) {
    return this.adminService.getSettlement({
      from: from ? Number(from) : undefined,
      to: to ? Number(to) : undefined,
    });
  }

  @ApiOperation({
    summary:
      "Elchi'dan olingan to'lovni qayd etish (M6). ⚠️ Kassaga TEGMAYDI — " +
      'faqat solishtirish daftari.',
  })
  @Post('settlement/payments')
  async addPayment(
    @Body() dto: AddSettlementPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.addSettlementPayment(dto, user);
  }

  @ApiOperation({ summary: "Xato kiritilgan to'lov yozuvini o'chirish" })
  @Delete('settlement/payments/:id')
  async deletePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.deleteSettlementPayment(id, user);
  }

  // ===================== BOSHQARUV =====================

  @ApiOperation({
    summary:
      "Integratsiyani butunlay to'xtatish (barcha bayroqlar o'chadi). " +
      "Ma'lumot O'CHIRILMAYDI.",
  })
  @Post('shutdown')
  async shutdown(@CurrentUser() user: JwtPayload) {
    return this.adminService.shutdown(user);
  }
}
