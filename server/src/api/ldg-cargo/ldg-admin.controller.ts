import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LdgAdminService } from './ldg-admin.service';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
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
  async reprocessWebhook(
    @Param('deliveryId') deliveryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.reprocessWebhook(deliveryId, user);
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
  async redispatch(
    @Param('orderId') orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.redispatch(orderId, user);
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
  async redispatchBatch(
    @Body() body: { orderIds: string[] },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.redispatchBatch(body?.orderIds ?? [], user);
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
  async resolveMismatch(
    @Param('orderId') orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.resolveMismatch(orderId, user);
  }

  // ===== BULK REDISPATCH (server tomonida, persistent) =====

  @ApiOperation({ summary: 'Barcha faol yuborilmaganlarni qayta jo\'natishni boshlash' })
  @Post('bulk-redispatch/start')
  async bulkRedispatchStart(@CurrentUser() user: JwtPayload) {
    return this.adminService.startBulkRedispatch(user);
  }

  @ApiOperation({ summary: 'Bulk jo\'natishni qo\'lda to\'xtatish' })
  @Post('bulk-redispatch/stop')
  async bulkRedispatchStop() {
    return this.adminService.stopBulkRedispatch();
  }

  @ApiOperation({ summary: 'Bulk jo\'natish holati (progress poll)' })
  @Get('bulk-redispatch/status')
  async bulkRedispatchStatus() {
    return this.adminService.getBulkRedispatchStatus();
  }

  // ===== AVTOMATIKA BOSHQARUVI =====

  @ApiOperation({ summary: 'Fon jarayonlari holati (webhook/reconcile/auto-retry/bulk)' })
  @Get('automations')
  async automations() {
    return this.adminService.getAutomations();
  }

  @ApiOperation({ summary: 'Fon jarayonini yoqish/o\'chirish' })
  @Patch('automations')
  async setAutomation(
    @Body()
    body: {
      key: 'webhook_enabled' | 'reconcile_enabled' | 'auto_retry_enabled';
      value: boolean;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.setAutomation(body.key, body.value, user);
  }

  @ApiOperation({ summary: 'Webhook log\'ni o\'chirish' })
  @Delete('webhook-logs/:deliveryId')
  async deleteWebhookLog(
    @Param('deliveryId') deliveryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.deleteWebhookLog(deliveryId, user);
  }
}
