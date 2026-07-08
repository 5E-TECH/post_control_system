import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { AiTransactionEntity } from 'src/core/entity/ai-transaction.entity';
import { AiBalanceService } from './ai-balance.service';
import { AiBalanceController } from './ai-balance.controller';
import { MyLogger } from 'src/logger/logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, AiTransactionEntity])],
  providers: [AiBalanceService, MyLogger],
  controllers: [AiBalanceController],
  exports: [AiBalanceService],
})
export class AiBalanceModule {}
