import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { TelegrafModule } from 'nestjs-telegraf';
import config from 'src/config';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      botName: 'XPrinter',
      useFactory: () => ({
        token: config.BOT_TOKEN,
        include: [BotModule],
      }),
    }),
    TypeOrmModule.forFeature([UserEntity, TelegramEntity]),
  ],
  providers: [BotService, BotUpdate],
  exports: [BotService],
})
export class BotModule {}
