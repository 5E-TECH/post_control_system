import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
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
import { muteBotOutbound } from 'src/common/utils/bot-mute.util';
import { Group_type, Roles } from 'src/common/enums';
import {
  isMarketUsable,
  MARKET_BLOCKED_MESSAGE_UZ,
} from 'src/common/utils/market-gate.util';

@Injectable()
export class BotService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(TelegramEntity)
    private readonly telegramRepo: TelegramRepository,

    @InjectBot(config.BOT_NAME) private readonly bot: Telegraf,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * ⚠️ BOTLAR O'CHIRILGANDA CHIQUVCHI CHAQIRUVLAR HAM TO'XTAYDI.
   *
   * `launchOptions: false` faqat POLLINGni to'xtatadi — bot obyekti
   * baribir yaratiladi va `sendMessage` Telegram'ga ketaverardi. Lokal
   * bazadagi `group_id` lar haqiqiy guruhlarga ishora qilishi mumkin,
   * shuning uchun chiquvchi tomon ham yopiladi.
   */
  onModuleInit(): void {
    if (!config.BOTS_ENABLED) {
      muteBotOutbound(this.bot, 'notify-bot');
    }
  }

  async addToGroup(text: string, ctx: Context) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      /**
       * ⚠️ DARVOZA 1 — FAQAT GURUH. Shaxsiy chat QABUL QILINMAYDI.
       *
       * Ilgari bu tekshiruv YO'Q edi (order-botda esa 6 joyda bor).
       * Natijada tokenni botga SHAXSIY yozgan odamning o'z chati
       * "bekor qilish guruhi" bo'lib ulanib qolardi va marketning
       * bekor qilish xabarlari o'sha odamga oqardi.
       *
       * Bu prod bazada HAQIQATAN sodir bo'lgan: 8810 marketining
       * `cancel` qatorida group_id MUSBAT son (1320841140) turibdi —
       * Telegramda guruh id'lari MANFIY, musbat son = shaxsiy chat.
       */
      const chatType = ctx.chat?.type;
      if (chatType !== 'group' && chatType !== 'supergroup') {
        throw new BadRequestException(
          'Tokenni GURUH ichida yuboring. Shaxsiy chatga ulab bo\'lmaydi.',
        );
      }

      const groupId = String(ctx.chat?.id);

      /**
       * ⚠️ DARVOZA 2 — `role: MARKET`.
       *
       * Ilgari rol filtri yo'q edi: token qiymati boshqa roldagi
       * foydalanuvchiga tegishli bo'lsa ham mos kelaverardi.
       * order-bot buni allaqachon tekshiradi (order-bot.service.ts:187).
       */
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { market_tg_token: text, role: Roles.MARKET },
      });

      if (!market) {
        throw new NotFoundException("Token noto'g'ri yoki eskirgan.");
      }

      /**
       * ⚠️ DARVOZA 3 — BLOKLANGAN MARKET ULANA OLMAYDI.
       *
       * order-bot.service.ts:253 da bu tekshiruv bor, bu yerda yo'q edi.
       * Bloklangan market bekor qilish guruhini ulab, blokdan keyin ham
       * xabar oqimini saqlab qola olardi.
       */
      if (!isMarketUsable(market)) {
        throw new ForbiddenException(MARKET_BLOCKED_MESSAGE_UZ);
      }

      /**
       * ⚠️ DARVOZA 4 — GURUH IKKI MARTA ULANMASIN.
       *
       * Avvalgi shart `group_type: Group_type.CANCEL || null` edi —
       * bu O'LIK yozuv: `Group_type.CANCEL` bo'sh bo'lmagan satr,
       * shuning uchun `|| null` HECH QACHON ishlamaydi. Ya'ni eski
       * (group_type BO'SH) qatorlar tekshiruvdan o'tib ketardi va
       * o'sha guruh ikki marta ulanib, xabarlar TAKRORLANARDI.
       *
       * Bo'sh `group_type` — eski koddan qolgan qatorlar; ular o'z
       * vaqtida HAMMA turdagi xabarni olardi, demak ular ham
       * to'qnashuv hisoblanadi.
       */
      const sameGroup = await queryRunner.manager.find(TelegramEntity, {
        where: { group_id: groupId },
      });
      const alreadyConnected = sameGroup.some(
        (t) => t.group_type === Group_type.CANCEL || !t.group_type,
      );
      if (alreadyConnected) {
        throw new ConflictException(
          'Bu guruh allaqachon ulangan.',
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
      /**
       * ⚠️ BUTUN `market` obyekti QAYTARILMAYDI.
       *
       * Yuqorida `market.market_tg_token` ga YANGI token yozilgan.
       * Butun obyektni qaytarish uni chaqiruvchiga (va kelajakda
       * ctx.reply ga) uzatib yuborish xavfini tug'diradi — guruhdagi
       * HAMMA a'zo ko'rib qoladi va Telegram tarixida abadiy qoladi.
       */
      return successRes(
        { market_id: market.id },
        200,
        `✅ ${market.name} uchun bekor qilingan buyurtmalar shu guruhga yuboriladi!`,
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

  remove(id: number) {
    return `This action removes a #${id} bot`;
  }
}
