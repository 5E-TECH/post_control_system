import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { AiTransactionEntity } from 'src/core/entity/ai-transaction.entity';
import { AiBalanceService } from './ai-balance.service';
import { AiBalanceController } from './ai-balance.controller';
import { MyLogger } from 'src/logger/logger.service';
import { OrderBotModule } from 'src/api/bots/order_create-bot/order-bot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AiTransactionEntity]),
    // topup'да BotNotifyService bilan foydalanuvchini xabardor qilamiz; sikl
    // (order-bot ai-balance'ni import qiladi) forwardRef bilan yopiladi.
    forwardRef(() => OrderBotModule),
  ],
  providers: [AiBalanceService, MyLogger],
  controllers: [AiBalanceController],
  exports: [AiBalanceService],
})
export class AiBalanceModule {}
