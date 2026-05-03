import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @ApiOperation({ summary: 'Get all activity logs (admin)' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get()
  getAllLogs(
    @Query('entity_type') entity_type?: string,
    @Query('action') action?: string,
    @Query('excludeAction') excludeAction?: string,
    @Query('user_id') user_id?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activityLogService.getAllLogs({
      entity_type,
      action,
      excludeAction,
      user_id,
      search,
      fromDate,
      toDate,
      page: Number(page) || 1,
      limit: Number(limit) || 50,
    });
  }

  @ApiOperation({ summary: 'Get logs for specific entity (order, post, etc.)' })
  @ApiParam({
    name: 'type',
    description: 'Entity type: order, post, user, cashbox',
  })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @Get(':type/:id')
  getEntityLogs(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activityLogService.getLogsByEntity(
      type,
      id,
      Number(page) || 1,
      Number(limit) || 50,
    );
  }
}
