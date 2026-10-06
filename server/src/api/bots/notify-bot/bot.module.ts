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
      botName: config.BOT_NAME,
      useFactory: () => ({
        token: config.BOT_TOKEN,
        include: [BotModule],
        /**
         * ⚠️ `false` bo'lsa `bot.launch()` CHAQIRILMAYDI — polling
         * boshlanmaydi va lokal nusxa Telegram'dan kelayotgan xabarlarni
         * o'ziga tortib olmaydi. Chiquvchi tomon `muteBotOutbound` bilan
         * yopiladi (src/common/utils/bot-mute.util.ts).
         */
        launchOptions: config.BOTS_ENABLED
          ? { dropPendingUpdates: true }
          : false,
        options: {
          handlerTimeout: 90_000,
          telegram: {
            apiRoot: 'https://api.telegram.org',
            agent: undefined,
            timeoutMs: 30_000,
          },
        },
      }),
    }),
    TypeOrmModule.forFeature([UserEntity, TelegramEntity]),
  ],
  providers: [BotService, BotUpdate],
  exports: [BotService],
})
export class BotModule {}
