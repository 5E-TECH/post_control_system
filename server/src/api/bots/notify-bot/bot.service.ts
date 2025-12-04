import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { TelegramRepository } from 'src/core/repository/telegram-market.repository';
import { InjectBot } from 'nestjs-telegraf';
import { DataSource } from 'typeorm';
import { generateCustomToken } from 'src/infrastructure/lib/qr-token/qr.token';
import config from 'src/config';
import { Group_type } from 'src/common/enums';

@Injectable()
export class BotService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(TelegramEntity)
    private readonly telegramRepo: TelegramRepository,

    @InjectBot(config.BOT_NAME) private readonly bot: Telegraf,

    private readonly dataSource: DataSource,
  ) {}
  // async startBot(ctx: Context) {
  //   try {
  //     return `Ushbu guruh idsi: ${ctx.chat?.id} va turi ${ctx.chat?.type}`;
  //   } catch (error) {
  //     return error;
  //   }
  // }

  async addToGroup(text: string, ctx: Context) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const groupId = String(ctx.chat?.id);
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { market_tg_token: text },
      });

      if (!market) {
        throw new NotFoundException('Market not found');
      }
      const isGroupConnected = await queryRunner.manager.findOne(
        TelegramEntity,
        {
          where: { group_id: groupId, group_type: Group_type.CANCEL || null },
        },
      );
      if (isGroupConnected) {
        throw new ConflictException(
          'This bot already activated for this group',
        );
      }
      const telegram = queryRunner.manager.create(TelegramEntity, {
        token: text,
        market_id: market?.id,
        group_id: String(ctx.chat?.id),
        group_type: Group_type.CANCEL,
      });
      await queryRunner.manager.save(telegram);

      const telegram_token = 'group_token-' + generateCustomToken();
      market.market_tg_token = telegram_token;
      await queryRunner.manager.save(market);

      await queryRunner.commitTransaction();
      return successRes(market, 200, `${market?.name} uchun telegram bot`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const message =
        error?.response?.message ||
        error?.message ||
        'Noma’lum xatolik yuz berdi';
      return { message: message || 'error' };
    } finally {
      await queryRunner.release();
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
      const message =
        error?.response?.message ||
        error?.message ||
        'Noma’lum xatolik yuz berdi';
      return { message: message || 'error' };
    }
  }

  // async createOrder(text: string, ctx: Context) {
  //   const queryRunner = this.dataSource.createQueryRunner();
  //   await queryRunner.connect();
  //   await queryRunner.startTransaction();
  //   try {
  //     const groupId = String(ctx.chat?.id);
  //     await queryRunner.manager.findOne(TelegramEntity, {
  //       where: { group_id: groupId },
  //     });
  //   } catch (error) {
  //     await queryRunner.rollbackTransaction();
  //     return catchError(error);
  //   } finally {
  //     await queryRunner.release();
  //   }
  // }

  remove(id: number) {
    return `This action removes a #${id} bot`;
  }
}
