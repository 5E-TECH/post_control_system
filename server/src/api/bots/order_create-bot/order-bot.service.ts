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
import { MyContext } from './session.interface';
import { Roles, Status } from 'src/common/enums';
import config from 'src/config';

@Injectable()
export class OrderBotService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(TelegramEntity)
    private readonly telegramRepo: TelegramRepository,

    @InjectBot('Shodiyors') private readonly bot: Telegraf,

    private readonly dataSource: DataSource,
  ) {}

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
          where: { group_id: groupId },
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
      });
      await queryRunner.manager.save(telegram);

      const telegram_token = 'group_token-' + generateCustomToken();
      market.market_tg_token = telegram_token;
      await queryRunner.manager.save(market);

      await queryRunner.commitTransaction();
      return successRes(
        market,
        200,
        `${market?.name} nomidan yaratilgan yangi buyurtmalar ushbu guruhga jo'natiladi!`,
      );
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

  async checkToken(text: string, ctx: Context) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // const chatId = String(ctx.chat?.id);
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { market_tg_token: text },
      });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      return successRes(
        market,
        200,
        `${market.name} uchun operator ro'yxatdan o'tmoqchi`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async registerOperator(phone_number: string, ctx: MyContext) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const isExistUser = await queryRunner.manager.findOne(UserEntity, {
        where: {
          phone_number,
        },
      });
      if (isExistUser?.status === Status.INACTIVE) {
        return new BadRequestException('Sorry you have blocked!');
      }
      if (isExistUser) {
        return successRes(
          {},
          200,
          `Siz ushbu platformada allaqachon ${isExistUser.role} sifatida ro'yxatdan o'tgansiz`,
        );
      }
      const operator = queryRunner.manager.create(UserEntity, {
        name: ctx.session.name,
        phone_number,
        password: config.ADMIN_PASSWORD,
        role: Roles.OPERATOR,
        add_order: ctx.session.marketData.add_order,
        market_id: ctx.session.marketData.id,
      });

      await queryRunner.manager.save(operator);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
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

  shareContact() {
    const number = {
      keyboard: [[{ text: '📞 Raqamni ulashish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
    return number;
  }

  remove(id: number) {
    return `This action removes a #${id} bot`;
  }
}
