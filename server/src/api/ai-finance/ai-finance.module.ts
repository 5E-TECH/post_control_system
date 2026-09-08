import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiFinanceController } from './ai-finance.controller';
import { AiFinanceService } from './ai-finance.service';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { AiFinanceReportSnapshotEntity } from 'src/core/entity/ai-finance-report-snapshot.entity';
import { AiFinanceChatEntity } from 'src/core/entity/ai-finance-chat.entity';
import { AiFinanceConversationEntity } from 'src/core/entity/ai-finance-conversation.entity';
import { ClaudeService } from 'src/infrastructure/ai/claude.service';
import { MyLogger } from 'src/logger/logger.service';
import { OrderModule } from 'src/api/order/order.module';
import { CashBoxModule } from 'src/api/cash-box/cash-box.module';
import { AiUsageModule } from 'src/api/ai-usage/ai-usage.module';

/**
 * Moliyaviy AI — faqat-o'qish analitik surface (superadmin/admin).
 * Xom moliyaviy ma'lumotni (financial_balance_history) AI bilan xarajat
 * hisoboti/kategoriya/insightga aylantiradi. Pul ko'chirmaydi (write yo'q).
 * ClaudeService to'g'ridan provider (order-bot moduli kabi — InfrastructureModule yo'q).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinancialBalanceHistoryEntity,
      AiFinanceReportSnapshotEntity,
      AiFinanceChatEntity,
      AiFinanceConversationEntity,
    ]),
    // Savol-javob tool'lari uchun (OrderService, CashBoxService) — export qilingan.
    OrderModule,
    CashBoxModule,
    // Elchin chat/hisobot xarajatini (ai_usage_log) yozish uchun.
    AiUsageModule,
  ],
  controllers: [AiFinanceController],
  providers: [AiFinanceService, ClaudeService, MyLogger],
})
export class AiFinanceModule {}
