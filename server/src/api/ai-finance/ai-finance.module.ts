import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiFinanceController } from './ai-finance.controller';
import { AiFinanceService } from './ai-finance.service';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { AiFinanceReportSnapshotEntity } from 'src/core/entity/ai-finance-report-snapshot.entity';
import { ClaudeService } from 'src/infrastructure/ai/claude.service';
import { MyLogger } from 'src/logger/logger.service';

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
    ]),
  ],
  controllers: [AiFinanceController],
  providers: [AiFinanceService, ClaudeService, MyLogger],
})
export class AiFinanceModule {}
