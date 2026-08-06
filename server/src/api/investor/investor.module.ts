import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestorController } from './investor.controller';
import { InvestorAdminController } from './investor-admin.controller';
import { InvestorService } from './investor.service';
import { InvestorLedgerService } from './investor-ledger.service';
import { OrderModule } from '../order/order.module';
import { CashBoxModule } from '../cash-box/cash-box.module';
import { RegionModule } from '../region/region.module';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { FinancialBalanceHistoryEntity } from 'src/core/entity/financial-balance-history.entity';
import { InvestorCapitalContributionEntity } from 'src/core/entity/investor-capital-contribution.entity';
import { InvestorCapitalWithdrawalEntity } from 'src/core/entity/investor-capital-withdrawal.entity';
import { InvestorOwnershipStakeEntity } from 'src/core/entity/investor-ownership-stake.entity';
import { InvestorDistributionEntity } from 'src/core/entity/investor-distribution.entity';
import { InvestorBasisRequestEntity } from 'src/core/entity/investor-basis-request.entity';
import { LogInvestorAccessInterceptor } from 'src/common/interceptors/log-investor-access.interceptor';

/**
 * Investor (ulushdor) faqat-o'qish surface'i. Mavjud aggregat servislarni
 * qayta ishlatadi:
 *   OrderModule    -> OrderService (getStats, getRevenueStats, getTop*)
 *   CashBoxModule  -> CashBoxService (financialBalance)
 *   RegionModule   -> RegionService (getAllRegionsStats)
 * ActivityLogService @Global bo'lgani uchun interceptor uni to'g'ridan inject qiladi.
 */
@Module({
  imports: [
    OrderModule,
    CashBoxModule,
    RegionModule,
    TypeOrmModule.forFeature([
      OrderEntity,
      UserEntity,
      FinancialBalanceHistoryEntity,
      InvestorCapitalContributionEntity,
      InvestorCapitalWithdrawalEntity,
      InvestorOwnershipStakeEntity,
      InvestorDistributionEntity,
      InvestorBasisRequestEntity,
    ]),
  ],
  controllers: [InvestorController, InvestorAdminController],
  providers: [InvestorService, InvestorLedgerService, LogInvestorAccessInterceptor],
})
export class InvestorModule {}
