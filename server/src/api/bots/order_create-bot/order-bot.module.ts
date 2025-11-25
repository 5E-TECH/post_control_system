import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { OrderBotUpdate } from './order-bot.update';
import { TelegrafModule } from 'nestjs-telegraf';
import config from 'src/config';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      botName: 'Shodiyors',
      useFactory: () => ({
        token: config.ORDER_BOT_TOKEN,
        include: [OrderBotModule],
      }),
    }),
    TypeOrmModule.forFeature([UserEntity, TelegramEntity]),
  ],
  providers: [OrderBotUpdate],
})
export class OrderBotModule {}
