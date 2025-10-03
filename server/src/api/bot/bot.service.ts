import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { Context, Telegraf } from 'telegraf';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { TelegramRepository } from 'src/core/repository/telegram-market.repository';
import { InjectBot } from 'nestjs-telegraf';

@Injectable()
export class BotService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(TelegramEntity)
    private readonly telegramRepo: TelegramRepository,

    @InjectBot() private readonly bot: Telegraf,
  ) {}
  // async startBot(ctx: Context) {
  //   try {
  //     return `Ushbu guruh idsi: ${ctx.chat?.id} va turi ${ctx.chat?.type}`;
  //   } catch (error) {
  //     return error;
  //   }
  // }

  async addToGroup(text: string, ctx: Context) {
    try {
      const groupId = String(ctx.chat?.id);
      const market = await this.userRepo.findOne({
        where: { market_tg_token: text },
      });

      if (!market) {
        throw new NotFoundException('Market not found');
      }
      const isGroupConnected = await this.telegramRepo.findOne({
        where: { group_id: groupId },
      });
      if (isGroupConnected) {
        throw new ConflictException(
          'This bot already activated for this group',
        );
      }
      const telegram = this.telegramRepo.create({
        token: text,
        market_id: market?.id,
        group_id: String(ctx.chat?.id),
      });
      await this.telegramRepo.save(telegram);
      return successRes(market, 200, `${market?.name} uchun telegram bot`);
    } catch (error) {
      const message =
        error?.response?.message ||
        error?.message ||
        'Noma’lum xatolik yuz berdi';
      return { message: message || 'error' };
    }
  }

  async sendMessageToGroup(groupId: string | null, message: string) {
    try {
      if (!groupId) {
        throw new BadRequestException('Group not found');
      }
      await this.bot.telegram.sendMessage(groupId, message, {
        parse_mode: 'Markdown',
      });
      return { success: true, message: 'Message sent successfully' };
    } catch (error) {
      console.error('Error sending message:', error);
      const message =
        error?.response?.message ||
        error?.message ||
        'Noma’lum xatolik yuz berdi';
      return { message: message || 'error' };
    }
  }

  remove(id: number) {
    return `This action removes a #${id} bot`;
  }
}
