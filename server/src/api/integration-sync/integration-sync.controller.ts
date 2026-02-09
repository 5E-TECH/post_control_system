import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IntegrationSyncService } from './integration-sync.service';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';

@Controller('integration-sync')
@UseGuards(JwtGuard, RolesGuard)
export class IntegrationSyncController {
  constructor(private readonly syncService: IntegrationSyncService) {}

  /**
   * Sync statistikasi
   */
  @Get('stats')
  @AcceptRoles(Roles.SUPERADMIN)
  async getStats() {
    return this.syncService.getSyncStats();
  }

  /**
   * Barcha sync joblarni olish (pagination bilan)
   */
  @Get('all')
  @AcceptRoles(Roles.SUPERADMIN)
  async getAllSyncs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'pending' | 'processing' | 'success' | 'failed',
    @Query('integration_id') integrationId?: string,
  ) {
    return this.syncService.getAllSyncs(
      Number(page) || 1,
      Number(limit) || 20,
      status,
      integrationId,
    );
  }

  /**
   * Failed sync joblarni olish
   */
  @Get('failed')
  @AcceptRoles(Roles.SUPERADMIN)
  async getFailedSyncs(@Query('integration_id') integrationId?: string) {
    return this.syncService.getFailedSyncs(integrationId);
  }

  /**
   * Muvaffaqiyatli sync joblarni olish
   */
  @Get('success')
  @AcceptRoles(Roles.SUPERADMIN)
  async getSuccessfulSyncs(
    @Query('integration_id') integrationId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.syncService.getSuccessfulSyncs(integrationId, Number(limit) || 50);
  }

  /**
   * Pending sync joblarni olish
   */
  @Get('pending')
  @AcceptRoles(Roles.SUPERADMIN)
  async getPendingSyncs() {
    return this.syncService.getPendingSyncs();
  }

  /**
   * Buyurtma bo'yicha sync tarixini olish
   */
  @Get('order/:orderId')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.MARKET)
  async getSyncsByOrder(@Param('orderId') orderId: string) {
    return this.syncService.getSyncsByOrder(orderId);
  }

  /**
   * Bitta job ni qayta sync qilish
   */
  @Post(':id/retry')
  @AcceptRoles(Roles.SUPERADMIN)
  async retrySync(@Param('id') id: string) {
    return this.syncService.retrySyncJob(id);
  }

  /**
   * Bir nechta job ni qayta sync qilish
   */
  @Post('bulk-retry')
  @AcceptRoles(Roles.SUPERADMIN)
  async bulkRetrySync(@Body('job_ids') jobIds: string[]) {
    return this.syncService.bulkRetrySyncJobs(jobIds);
  }

  /**
   * Barcha failed joblarni qayta sync qilish
   */
  @Post('retry-all-failed')
  @AcceptRoles(Roles.SUPERADMIN)
  async retryAllFailed(@Query('integration_id') integrationId?: string) {
    return this.syncService.retryAllFailedSyncs(integrationId);
  }

  /**
   * Sync job ni o'chirish
   */
  @Delete(':id')
  @AcceptRoles(Roles.SUPERADMIN)
  async deleteSync(@Param('id') id: string) {
    return this.syncService.deleteSyncJob(id);
  }
}
