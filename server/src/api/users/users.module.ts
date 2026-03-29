import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { UserService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { UserSalaryEntity } from 'src/core/entity/user-salary.entity';
import { RegionEntity } from 'src/core/entity/region.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { CustomerMarketEntity } from 'src/core/entity/customer-market.entity';
import { OperatorEarningEntity } from 'src/core/entity/operator-earning.entity';
import { OperatorPaymentEntity } from 'src/core/entity/operator-payment.entity';
import { InvestorDepositEntity } from 'src/core/entity/investor-deposit.entity';
import { InvestorEarningEntity } from 'src/core/entity/investor-earning.entity';
import { InvestorPayoutEntity } from 'src/core/entity/investor-payout.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      CashEntity,
      UserSalaryEntity,
      RegionEntity,
      DistrictEntity,
      CustomerMarketEntity,
      OperatorEarningEntity,
      OperatorPaymentEntity,
      InvestorDepositEntity,
      InvestorEarningEntity,
      InvestorPayoutEntity,
    ]),
  ],
  controllers: [UsersController],
  providers: [UserService, BcryptEncryption, Token],
})
export class UsersModule {}
