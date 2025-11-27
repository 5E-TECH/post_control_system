import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { OrderBotUpdate } from './order-bot.update';
import { TelegrafModule } from 'nestjs-telegraf';
import config from 'src/config';
import { OrderBotService } from './order-bot.service';
import { session } from 'telegraf';
import { MySession } from './session.interface';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      botName: 'Shodiyors',
      useFactory: () => ({
        token: config.ORDER_BOT_TOKEN,
        include: [OrderBotModule],
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
    TypeOrmModule.forFeature([UserEntity, TelegramEntity]),
  ],
  providers: [OrderBotUpdate, OrderBotService],
})
export class OrderBotModule {}
