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
import { LdgAdminService } from './ldg-admin.service';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';

@ApiTags('LDG Cargo Admin')
@ApiBearerAuth()
@Controller('ldg/admin')
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
export class LdgAdminController {
  constructor(private readonly adminService: LdgAdminService) {}

  @ApiOperation({ summary: 'LDG umumiy holat: setup checklist + statistika' })
  @Get('health')
  async health() {
    return this.adminService.getHealth();
  }

  @ApiOperation({ summary: 'LDG bilan ulanishni test qilish (ma\'lumot yaratmaydi)' })
  @Post('test-connection')
  async testConnection() {
    return this.adminService.testConnection();
  }

  @ApiOperation({ summary: 'Webhook loglar (paginatsiya + status/event filtri)' })
  @Get('webhook-logs')
  async webhookLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('event_type') eventType?: string,
  ) {
    return this.adminService.getWebhookLogs({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      event_type: eventType,
    });
  }

  @ApiOperation({ summary: 'Webhook log\'ni qayta ishlash (skip/failed uchun)' })
  @Post('webhook-logs/:deliveryId/reprocess')
  async reprocessWebhook(@Param('deliveryId') deliveryId: string) {
    return this.adminService.reprocessWebhook(deliveryId);
  }

  @ApiOperation({ summary: 'Jo\'natmalar (shipments) ro\'yxati' })
  @Get('shipments')
  async shipments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: 'all' | 'error' | 'delivered' | 'pending',
  ) {
    return this.adminService.getShipments({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      filter,
    });
  }

  @ApiOperation({ summary: 'Shipmentni qayta LDG\'ga jo\'natish' })
  @Post('shipments/:orderId/redispatch')
  async redispatch(@Param('orderId') orderId: string) {
    return this.adminService.redispatch(orderId);
  }

  @ApiOperation({
    summary: 'Yuborilmagan/xatoli barcha shipmentlarning order_id ro\'yxati',
  })
  @Get('shipments/retry-candidates')
  async retryCandidates() {
    return this.adminService.getRetryCandidates();
  }

  @ApiOperation({
    summary: 'Bir guruh (10 ta) buyurtmani ketma-ket qayta jo\'natish',
  })
  @Post('shipments/redispatch-batch')
  async redispatchBatch(@Body() body: { orderIds: string[] }) {
    return this.adminService.redispatchBatch(body?.orderIds ?? []);
  }

  @ApiOperation({
    summary: 'Bitta shipment statusini LDG\'dan tortib olib yangilash',
  })
  @Post('shipments/:orderId/sync')
  async syncOne(@Param('orderId') orderId: string) {
    return this.adminService.reconcileOne(orderId);
  }

  @ApiOperation({
    summary: 'Barcha faol shipmentlarni LDG bilan tenglashtirish (qo\'lda)',
  })
  @Post('reconcile')
  async reconcile() {
    return this.adminService.reconcileActiveShipments();
  }

  @ApiOperation({
    summary: 'Mismatch\'ni "hal qilindi" deb belgilash (admin tekshirib chiqqach)',
  })
  @Post('shipments/:orderId/resolve-mismatch')
  async resolveMismatch(@Param('orderId') orderId: string) {
    return this.adminService.resolveMismatch(orderId);
  }
}
