import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Roles } from 'src/common/enums';
import { ElchiConfigService } from './elchi-config.service';
import { ElchiShipmentService } from './elchi-shipment.service';
import { ElchiReconcileService } from './elchi-reconcile.service';
import { UpdateElchiConfigDto } from './dto/elchi-config.dto';

class BindElchiCourierDto {
  @IsUUID()
  user_id!: string;
}

class GatePreviewDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  order_ids!: string[];
}

class SetDistrictGateDto {
  @IsBoolean()
  is_enabled!: boolean;
}

/**
 * Tumanni QO'LDA moslash — avtomatik SOATO moslash ishlamaganda.
 * Elchi tuman id'si satr (uning bazasida bigint), UUID emas.
 */
class SetDistrictMappingDto {
  @IsString()
  @MaxLength(64)
  elchi_district_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  elchi_region_id?: string;
}

class ReclaimControlDto {
  /**
   * `true` — Elchi posilkasini bekor qilib bo'lmasa ham boshqaruvni tortib
   * olish. Faqat Elchi API butunlay ishlamayotganda ishlatiladi; posilka
   * nomuvofiqlik belgisi bilan qayd etiladi.
   */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

@ApiTags('Elchi')
@ApiBearerAuth()
@Controller('elchi')
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
export class ElchiConfigController {
  constructor(
    private readonly configService: ElchiConfigService,
    private readonly shipmentService: ElchiShipmentService,
    private readonly reconcileService: ElchiReconcileService,
  ) {}

  // ===================== SOZLAMA =====================

  @ApiOperation({
    summary: 'Elchi sozlamalarini olish (maxfiy maydonlar yashirilgan)',
  })
  @Get('config')
  async getConfig() {
    return this.configService.getSafe();
  }

  @ApiOperation({ summary: 'Elchi sozlamalarini yangilash' })
  @Patch('config')
  async updateConfig(
    @Body() dto: UpdateElchiConfigDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.configService.update(dto, user);
    // Javobda ham maxfiy maydonlar qaytmasligi kerak.
    return this.configService.getSafe();
  }

  @ApiOperation({
    summary:
      'TAYYORLIK CHEKLISTI — kalit, sekret, market, vakil-kuryer, tumanlar, ' +
      'ulanish va TARIF MOSLIGI. Tarif ikki tomonda teng bo‘lmasa hech qanday ' +
      'xato chiqmaydi, farq jimgina to‘planadi — shu bois mashina solishtiradi.',
  })
  @Get('readiness')
  async getReadiness() {
    return this.configService.getReadiness();
  }

  @ApiOperation({
    summary:
      "Ulanishni tekshirish (Elchi /partner/ping). Master kalit o'chirilgan " +
      "bo'lsa ham ishlaydi — sozlashni yakunlash uchun.",
  })
  @Post('config/test')
  async testConnection() {
    return this.configService.testConnection();
  }

  @ApiOperation({
    summary: 'Mavjud kuryerni Elchi vakil-kuryeri qilib biriktirish',
  })
  @Post('config/bind-courier')
  async bindCourier(
    @Body() dto: BindElchiCourierDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.configService.bindCourier(dto.user_id, user);
  }

  // ===================== TUMAN MOSLAMASI / DARVOZA =====================

  @ApiOperation({ summary: 'Tuman moslamasi va darvoza holati' })
  @Get('districts')
  async listDistricts() {
    return this.configService.listDistrictMap();
  }

  @ApiOperation({
    summary:
      "Elchi tumanlarini SOATO bo'yicha avtomatik moslashtirish. " +
      "DARVOZANI OCHMAYDI — ruxsat alohida beriladi.",
  })
  @Post('districts/sync')
  async syncDistricts(@CurrentUser() user: JwtPayload) {
    return this.configService.syncDistricts(user);
  }

  @ApiOperation({
    summary:
      "Tumanni QO'LDA moslash. Avtomatik moslash SOATO bo'yicha ishlaydi, " +
      "lekin Elchi tomonda haqiqiy SOATO bo'lmasa (o'rinbosar kod) shu yo'l " +
      "ishlatiladi. DARVOZAGA TEGMAYDI.",
  })
  @Patch('districts/:districtId/mapping')
  async setDistrictMapping(
    @Param('districtId', ParseUUIDPipe) districtId: string,
    @Body() dto: SetDistrictMappingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.configService.setDistrictMapping(
      districtId,
      dto.elchi_district_id,
      dto.elchi_region_id ?? null,
      user,
    );
  }

  @ApiOperation({
    summary:
      "Elchi'da BeePost market akkauntini ochish. Tarif VAKIL-KURYERDAN " +
      'olinadi (M4: ikki tomonda teng bo\'lishi shart). Idempotent.',
  })
  @Post('config/provision-market')
  async provisionMarket(@CurrentUser() user: JwtPayload) {
    return this.configService.provisionMarket(user);
  }

  @ApiOperation({
    summary:
      "DARVOZA: shu tumandagi buyurtmalarni Elchi'ga jo'natishga ruxsat berish " +
      "yoki bloklash",
  })
  @Patch('districts/:districtId/gate')
  async setDistrictGate(
    @Param('districtId', ParseUUIDPipe) districtId: string,
    @Body() dto: SetDistrictGateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.configService.setDistrictEnabled(
      districtId,
      dto.is_enabled,
      user,
    );
  }

  // ===================== JO'NATISHDAN OLDIN / KEYIN =====================

  @ApiOperation({
    summary:
      "DARVOZA OLDINDAN TEKSHIRUVI — jo'natish tugmasini bosishdan oldin " +
      "qaysi buyurtmalar bloklanishini ko'rsatadi. Xato tashlamaydi.",
  })
  @Post('gate/preview')
  async previewGate(@Body() dto: GatePreviewDto) {
    return this.shipmentService.previewGate(dto.order_ids);
  }

  @ApiOperation({
    summary:
      "Pochta bo'yicha jo'natish holati — nechta buyurtma Elchi'ga haqiqatan " +
      "yetdi. Dispatch fon rejimida ketgani uchun kerak.",
  })
  @Get('posts/:postId/dispatch-status')
  async getDispatchStatus(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.shipmentService.getDispatchStatusForPost(postId);
  }

  @ApiOperation({
    summary:
      "Elchi'ga yetmagan buyurtmani QAYTA jo'natish. Idempotent — Elchi " +
      "tomonda posilka allaqachon bo'lsa, yangisi ochilmaydi.",
  })
  @Post('orders/:orderId/dispatch-retry')
  async retryDispatch(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.shipmentService.createShipmentForOrder(orderId);
  }

  // ===================== SOLISHTIRISH (RECONCILE) =====================

  @ApiOperation({
    summary:
      "Elchi bilan tenglashtirish — ochiq posilkalarni Elchi'dan so'rab " +
      "holatni qo'llaydi. CRON'ni kutmasdan qo'lda ishga tushirish.",
  })
  @Post('reconcile')
  async reconcile() {
    return this.reconcileService.reconcileBatch();
  }

  @ApiOperation({
    summary: "Bitta buyurtmani Elchi bilan tenglashtirish",
  })
  @Post('orders/:orderId/reconcile')
  async reconcileOne(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.reconcileService.reconcileOne(orderId);
  }

  // ===================== BOSHQARUVNI QAYTARIB OLISH =====================

  @ApiOperation({
    summary:
      "ZAXIRA YO'LI: buyurtma boshqaruvini Elchi'dan qaytarib olish. " +
      "Avval Elchi posilkasi bekor qilinadi, keyin BeePostda amallar ochiladi — " +
      "ikki tomon bir vaqtda faol bo'lib qolmaydi.",
  })
  @Post('orders/:orderId/reclaim-control')
  async reclaimControl(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ReclaimControlDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.shipmentService.reclaimControl(orderId, user, {
      force: dto.force,
    });
  }
}
