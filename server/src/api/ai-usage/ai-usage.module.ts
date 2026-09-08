import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLogEntity } from 'src/core/entity/ai-usage-log.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { AiUsageService } from './ai-usage.service';
import { UzsRateService } from './uzs-rate.service';
import { AiUsageController } from './ai-usage.controller';
import { MyLogger } from 'src/logger/logger.service';

/**
 * AI real xarajat jurnali (ai_usage_log) + AI dashboard.
 * - ClaudeService har chaqiruvda token usage'ini AiUsageService.record() orqali
 *   shu jadvalga yozadi (order-bot, ai-finance modullari import qiladi).
 * - AiUsageController (superadmin/admin) dashboard agregatlarini beradi;
 *   AI buyurtma sanashi uchun OrderEntity repo ham kerak.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLogEntity, OrderEntity])],
  controllers: [AiUsageController],
  providers: [AiUsageService, UzsRateService, MyLogger],
  exports: [AiUsageService],
})
export class AiUsageModule {}
