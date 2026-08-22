import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLogEntity } from 'src/core/entity/ai-usage-log.entity';
import { AiUsageService } from './ai-usage.service';
import { MyLogger } from 'src/logger/logger.service';

/**
 * AI real xarajat jurnali (ai_usage_log). ClaudeService har chaqiruvda token
 * usage'ini AiUsageService.record() orqali shu jadvalga yozadi. AI ishlatadigan
 * modullar (order-bot, ai-finance) shu moduldan AiUsageService'ni oladi.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLogEntity])],
  providers: [AiUsageService, MyLogger],
  exports: [AiUsageService],
})
export class AiUsageModule {}
