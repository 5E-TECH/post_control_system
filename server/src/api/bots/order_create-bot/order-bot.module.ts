import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { ProductEntity } from 'src/core/entity/product.entity';
import { OrderBotUpdate } from './order-bot.update';
import { TelegrafModule } from 'nestjs-telegraf';
import config from 'src/config';
import { OrderBotService } from './order-bot.service';
import { session } from 'telegraf';
import { MySession } from './session.interface';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      botName: config.ORDER_BOT_NAME,
      useFactory: () => ({
        token: config.ORDER_BOT_TOKEN,
        include: [OrderBotModule],
        launchOptions: {
          dropPendingUpdates: true,
        },
        middlewares: [
          session({
            defaultSession: (): MySession => ({
              step: 'initial',
              waitingForPhone: false,
            }),
          }),
        ],
      }),
    }),
    TypeOrmModule.forFeature([
      UserEntity,
      TelegramEntity,
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
    ]),
  ],
  providers: [OrderBotUpdate, OrderBotService, Token, BcryptEncryption],
})
export class OrderBotModule {}
