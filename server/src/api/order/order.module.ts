import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { ProductEntity } from 'src/core/entity/product.entity';
import { ProductService } from '../product/product.service';
import { CashBoxModule } from '../cash-box/cash-box.module';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { OrderGateaway } from '../socket/order.gateaway';
import { PostEntity } from 'src/core/entity/post.entity';
import { MyLogger } from 'src/logger/logger.service';
import { BotModule } from '../bots/notify-bot/bot.module';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { OrderBotModule } from '../bots/order_create-bot/order-bot.module';
import { OrderBotService } from '../bots/order_create-bot/order-bot.service';
import { ExternalIntegrationModule } from '../external-integration/external-integration.module';
import { IntegrationSyncModule } from '../integration-sync/integration-sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
      CashEntity,
      CashboxHistoryEntity,
      UserEntity,
      PostEntity,
      TelegramEntity,
    ]),
    CashBoxModule,
    BotModule,
    OrderBotModule,
    ExternalIntegrationModule,
    IntegrationSyncModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderBotService,
    ProductService,
    BcryptEncryption,
    Token,
    OrderGateaway,
    MyLogger,
  ],
})
export class OrderModule {}
