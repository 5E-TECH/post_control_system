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
    TypeOrmModule.forFeature([UserEntity, TelegramEntity]),
    // TelegrafModule.forRoot({ token: config.BOT_TOKEN }),
  ],
  providers: [BotService, BotUpdate],
  exports: [BotService, TypeOrmModule], // 👈 Bu joyi to‘g‘ri, repository larni ham export qilayapti
})
export class BotModule {}
