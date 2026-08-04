import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestorController } from './investor.controller';
import { InvestorService } from './investor.service';
import { OrderModule } from '../order/order.module';
import { CashBoxModule } from '../cash-box/cash-box.module';
import { RegionModule } from '../region/region.module';
import { OrderEntity } from 'src/core/entity/order.entity';
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
    TypeOrmModule.forFeature([OrderEntity]),
  ],
  controllers: [InvestorController],
  providers: [InvestorService, LogInvestorAccessInterceptor],
})
export class InvestorModule {}
