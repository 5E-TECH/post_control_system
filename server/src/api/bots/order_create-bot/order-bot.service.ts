import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { Group_type, Order_status, Roles, Status } from 'src/common/enums';
import config from 'src/config';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { MyLogger } from 'src/logger/logger.service';
import { randomBytes } from 'crypto';

const MARKDOWN_ESCAPE_REGEX = /[_*`\[\]]/g;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

@Injectable()
export class OrderBotService {
  private readonly tokenAttempts = new Map<number, number[]>();

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(TelegramEntity)
    private readonly telegramRepo: TelegramRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectBot(config.ORDER_BOT_NAME) private readonly bot: Telegraf,

    private readonly token: Token,
    private readonly dataSource: DataSource,
    private readonly bcrypt: BcryptEncryption,
    private readonly logger: MyLogger,
  ) {}

  private escapeMarkdown(value: unknown): string {
    if (value === null || value === undefined) return '-';
    return String(value).replace(
      MARKDOWN_ESCAPE_REGEX,
      (match) => `\\${match}`,
    );
  }

  private formatPrice(value: number | string) {
    const numeric = Number(value) || 0;
    return numeric.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  private statusButtonLabel(order: OrderEntity) {
    const status = order.deleted_at
      ? 'deleted'
      : order.status || Order_status.CREATED;

    const iconMap: Record<string, string> = {
      [Order_status.CREATED]: '🟡',
      [Order_status.NEW]: '🟢',
      [Order_status.RECEIVED]: '📦',
      [Order_status.ON_THE_ROAD]: '🚚',
      [Order_status.WAITING]: '⏳',
      [Order_status.SOLD]: '✅',
      [Order_status.CANCELLED]: '❌',
      [Order_status.PAID]: '💰',
      [Order_status.PARTLY_PAID]: '💸',
      [Order_status.CANCELLED_SENT]: '📮',
      [Order_status.CLOSED]: '🔒',
      deleted: '🗑️',
    };

    const icon = iconMap[status] || 'ℹ️';
    return `Holat: ${icon} ${status}`;
  }

  private normalizePhone(input: string): string {
    const trimmed = (input || '').trim();
    return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
  }

  private isTokenRateLimited(userId: number): boolean {
    const now = Date.now();
    const previous = (this.tokenAttempts.get(userId) || []).filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS,
    );
    previous.push(now);
    this.tokenAttempts.set(userId, previous);
    return previous.length > RATE_LIMIT_MAX_ATTEMPTS;
  }

  private resolveWebAppUrl(): string {
    const raw = (config.WEB_APP_URL || '').trim();
    if (!raw) {
      throw new BadRequestException('WEB_APP_URL is not configured');
    }
    return raw.replace(/\/$/, '');
  }

  private rotateMarketToken(
    manager: import('typeorm').EntityManager,
    market: UserEntity,
  ) {
    market.market_tg_token = 'group_token-' + generateCustomToken();
    return manager.save(UserEntity, market);
  }

  async syncStatusButton(orderId: string) {
    try {
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order || !order.create_bot_messages?.length) return;

      const inline_keyboard = [
        [
          {
            text: this.statusButtonLabel(order),
            callback_data: `order:status:${order.id}`,
          },
        ],
      ];

      await Promise.all(
        order.create_bot_messages.map(async ({ chatId, messageId }) => {
          try {
            await this.bot.telegram.editMessageReplyMarkup(
              chatId,
              messageId,
              undefined,
              { inline_keyboard },
            );
          } catch (err) {
            this.logger.log(
              `syncStatusButton edit failed: ${(err as Error).message}`,
              'OrderBot',
            );
          }
        }),
      );
    } catch (err) {
      this.logger.log(
        `syncStatusButton error: ${(err as Error).message}`,
        'OrderBot',
      );
    }
  }

  async addToGroup(text: string, ctx: Context) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const groupId = String(ctx.chat?.id);
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { market_tg_token: text, role: Roles.MARKET },
      });

      if (!market) {
        throw new NotFoundException("Token noto'g'ri yoki eskirgan.");
      }

      const isGroupConnected = await queryRunner.manager.findOne(
        TelegramEntity,
        {
          where: { group_id: groupId, group_type: Group_type.CREATE },
        },
      );
      if (isGroupConnected) {
        throw new ConflictException(
          'Bu guruh allaqachon buyurtmalar uchun ulangan.',
        );
      }

      const telegram = queryRunner.manager.create(TelegramEntity, {
        token: text,
        market_id: market.id,
        group_id: groupId,
        group_type: Group_type.CREATE,
      });
      await queryRunner.manager.save(telegram);

      await this.rotateMarketToken(queryRunner.manager, market);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Group ${groupId} activated for market ${market.id}`,
        'OrderBot',
      );

      return successRes(
        { market_id: market.id },
        200,
        `✅ ${market.name} nomidan yaratilgan yangi buyurtmalar shu guruhga yuboriladi!`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async checkToken(text: string, ctx: Context) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { market_tg_token: text, role: Roles.MARKET },
      });
      if (!market) {
        throw new NotFoundException("Token noto'g'ri yoki eskirgan.");
      }

      await this.rotateMarketToken(queryRunner.manager, market);
      await queryRunner.commitTransaction();

      return successRes(
        { id: market.id, name: market.name, add_order: market.add_order },
        200,
        `${market.name} uchun ro'yxatdan o'tmoqchisiz`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async registerNewOperator(phone_number: string, ctx: MyContext) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (!ctx.session.marketData?.id) {
        throw new BadRequestException(
          "Avval market tokenini yuboring va so'ng raqamingizni ulashing.",
        );
      }

      const contact = this.normalizePhone(phone_number);
      const telegramUserId = ctx.from?.id;

      const existingUser = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number: contact, is_deleted: false },
      });

      if (existingUser) {
        if (existingUser.status === Status.INACTIVE) {
          throw new ForbiddenException(
            'Kechirasiz, siz tizimda bloklangansiz.',
          );
        }

        if (
          existingUser.role !== Roles.MARKET &&
          existingUser.role !== Roles.OPERATOR
        ) {
          throw new ForbiddenException(
            'Bu telefon raqam market yoki operator sifatida ishlatilmaydi.',
          );
        }

        if (
          existingUser.telegram_id &&
          Number(existingUser.telegram_id) !== Number(telegramUserId)
        ) {
          throw new ConflictException(
            "Bu telefon raqam boshqa Telegram hisobi bilan bog'langan. Admin bilan bog'laning.",
          );
        }

        if (!existingUser.telegram_id && telegramUserId) {
          existingUser.telegram_id = telegramUserId;
          await queryRunner.manager.save(existingUser);
          this.logger.log(
            `Linked telegram_id=${telegramUserId} to existing user ${existingUser.id} (${existingUser.role})`,
            'OrderBot',
          );
        }

        await queryRunner.commitTransaction();
        return successRes(
          { id: existingUser.id, role: existingUser.role },
          200,
          existingUser.role === Roles.MARKET
            ? "Siz market sifatida ro'yxatdan o'tgansiz. Buyurtma yaratishingiz mumkin."
            : "Siz operator sifatida ro'yxatdan o'tgansiz. Buyurtma yaratishingiz mumkin.",
        );
      }

      if (telegramUserId) {
        const existingByTelegramId = await queryRunner.manager.findOne(
          UserEntity,
          {
            where: { telegram_id: telegramUserId, is_deleted: false },
          },
        );
        if (existingByTelegramId) {
          throw new ConflictException(
            "Bu Telegram hisobi boshqa foydalanuvchiga bog'langan. Admin bilan bog'laning.",
          );
        }
      }

      const market = await queryRunner.manager.findOne(UserEntity, {
        where: { id: ctx.session.marketData.id, is_deleted: false },
      });
      if (!market || market.role !== Roles.MARKET) {
        throw new NotFoundException(
          "Market topilmadi. Tokenni qayta yuborib ko'ring.",
        );
      }

      const tempPassword = randomBytes(6).toString('hex');
      const hashedPassword = await this.bcrypt.encrypt(tempPassword);
      const operator = queryRunner.manager.create(UserEntity, {
        name: ctx.session.name || 'Operator',
        phone_number: contact,
        password: hashedPassword,
        role: Roles.OPERATOR,
        add_order: ctx.session.marketData.add_order ?? true,
        market_id: ctx.session.marketData.id,
        telegram_id: telegramUserId,
      });

      await queryRunner.manager.save(operator);
      await queryRunner.commitTransaction();

      this.logger.log(
        `New operator ${operator.id} registered via bot for market ${ctx.session.marketData.id}`,
        'OrderBot',
      );

      try {
        await this.bot.telegram.sendMessage(
          ctx.from?.id as number,
          `🔐 *Vaqtinchalik parolingiz:* \`${tempPassword}\`\n\n` +
            `Ushbu parol bilan platformaga kira olasiz, lekin darhol yangilash tavsiya etiladi.`,
          { parse_mode: 'Markdown' },
        );
      } catch (err) {
        this.logger.log(
          `Temp password DM failed: ${(err as Error).message}`,
          'OrderBot',
        );
      }

      return successRes(
        { id: operator.id, role: operator.role },
        201,
        "Siz Beepost platformasida muvaffaqiyatli ro'yxatdan o'tdingiz! Buyurtma yaratishingiz mumkin.",
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async signInWithTelegram(ctx: Context) {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        throw new BadRequestException('Telegram foydalanuvchi aniqlanmadi.');
      }

      const user = await this.userRepo.findOne({
        where: { telegram_id: telegramId, is_deleted: false },
      });

      if (!user) {
        throw new NotFoundException("Siz platformadan ro'yxatdan o'tmagansiz!");
      }

      if (user.status === Status.INACTIVE) {
        throw new ForbiddenException('Siz ushbu platformadan bloklangansiz.');
      }

      if (user.role !== Roles.OPERATOR && user.role !== Roles.MARKET) {
        throw new ForbiddenException(
          'Kechirasiz, siz bot orqali buyurtma yaratish huquqiga ega emassiz.',
        );
      }

      const { id, role, status } = user;
      const payload: JwtPayload = { id, role, status };
      const accessToken = await this.token.generateAccessToken(payload);

      return successRes(
        { access_token: accessToken, user: { id, role, name: user.name } },
        200,
        'Logged in successfully',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  private buildOrderMessage(order: OrderEntity) {
    const customerDistrict = order.customer?.district;
    const regionName = this.escapeMarkdown(customerDistrict?.region?.name);
    const districtName = this.escapeMarkdown(customerDistrict?.name);
    const addressLine =
      regionName !== '-' && districtName !== '-'
        ? `${regionName}, ${districtName}`
        : districtName !== '-'
          ? districtName
          : regionName;

    const itemsText = order.items
      ?.map(
        (item, i) =>
          `   ${i + 1}. ${this.escapeMarkdown(item.product?.name)} — ${item.quantity} dona`,
      )
      .join('\n');

    return (
      `*✅ Yangi buyurtma!*\n\n` +
      `👤 *Mijoz:* ${this.escapeMarkdown(order.customer?.name)}\n` +
      `📞 *Telefon:* ${this.escapeMarkdown(order.customer?.phone_number)}\n` +
      `📍 *Manzil:* ${addressLine}\n\n` +
      `📦 *Buyurtmalar:*\n${itemsText || '-'}\n\n` +
      `💰 *Narxi:* ${this.formatPrice(order.total_price)} so'm\n` +
      `🕒 *Yaratilgan vaqti:* ${new Date(
        Number(order.created_at),
      ).toLocaleString('uz-UZ')}\n\n` +
      `🧑‍💻 *Operator:* ${this.escapeMarkdown(order.operator)}\n\n` +
      `📝 *Izoh:* ${this.escapeMarkdown(order.comment)}\n`
    );
  }

  async sendOrderForApproval(
    groupId: string | null,
    order: OrderEntity,
  ): Promise<{
    success: boolean;
    message: string;
    sentMessage?: { chatId: number; messageId: number };
  }> {
    try {
      if (!groupId) {
        throw new BadRequestException('Group not found');
      }

      const message = this.buildOrderMessage(order);
      const sent = await this.bot.telegram.sendMessage(groupId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: this.statusButtonLabel(order),
                callback_data: `order:status:${order.id}`,
              },
            ],
            [
              {
                text: '✅ Tasdiqlash',
                callback_data: `order:approve:${order.id}`,
              },
              {
                text: '❌ Bekor qilish',
                callback_data: `order:cancel:${order.id}`,
              },
            ],
          ],
        },
      });

      return {
        success: true,
        message: 'Message sent successfully',
        sentMessage: {
          chatId: Number(sent.chat.id),
          messageId: sent.message_id,
        },
      };
    } catch (error) {
      this.logger.log(
        `sendOrderForApproval failed: ${(error as Error).message}`,
        'OrderBot',
      );
      return { success: false, message: (error as Error).message || 'error' };
    }
  }

  private async isCallbackAuthorized(
    marketId: string,
    chatId: number | string | undefined,
  ): Promise<boolean> {
    if (!chatId || !marketId) return false;
    const telegramGroup = await this.telegramRepo.findOne({
      where: {
        group_id: String(chatId),
        market_id: marketId,
        group_type: Group_type.CREATE,
      },
    });
    return !!telegramGroup;
  }

  async processOrderAction(
    action: 'approve' | 'cancel',
    orderId: string,
    ctx: Context,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: [
          'items',
          'items.product',
          'customer',
          'customer.district',
          'customer.district.region',
        ],
      });

      if (!order) {
        throw new NotFoundException('Buyurtma topilmadi.');
      }

      const authorized = await this.isCallbackAuthorized(
        order.user_id,
        ctx.chat?.id,
      );
      if (!authorized) {
        throw new ForbiddenException("Bu amal uchun sizda ruxsat yo'q.");
      }

      if (order.deleted_at || order.status !== Order_status.CREATED) {
        return successRes(
          order,
          200,
          "Bu buyurtma allaqachon ko'rib chiqilgan",
        );
      }

      if (action === 'approve') {
        order.status = Order_status.NEW;
        await queryRunner.manager.save(order);
      } else {
        // Soft delete — TypeORM deleted_at = NOW yozadi
        await queryRunner.manager.softDelete(OrderEntity, { id: order.id });
        order.deleted_at = new Date();
      }

      await queryRunner.commitTransaction();

      const statusText =
        action === 'approve'
          ? '✅ Buyurtma tasdiqlandi'
          : '❌ Buyurtma bekor qilindi';

      const statusButton = {
        text: this.statusButtonLabel(order),
        callback_data: `order:status:${order.id}`,
      };

      const storedMessages = order.create_bot_messages || [];
      const cbMessage = ctx.callbackQuery?.message;
      if (cbMessage?.chat?.id && cbMessage?.message_id) {
        const exists = storedMessages.some(
          (m) =>
            m.chatId === Number(cbMessage.chat.id) &&
            m.messageId === cbMessage.message_id,
        );
        if (!exists) {
          storedMessages.push({
            chatId: Number(cbMessage.chat.id),
            messageId: cbMessage.message_id,
          });
          await this.dataSource.manager.update(
            OrderEntity,
            { id: order.id },
            { create_bot_messages: storedMessages },
          );
        }
      }

      const inline_keyboard = [[statusButton]];

      await Promise.all(
        storedMessages.map(async ({ chatId, messageId }) => {
          try {
            await this.bot.telegram.editMessageText(
              chatId,
              messageId,
              undefined,
              `${this.buildOrderMessage(order)}\n\n${statusText}`,
              {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard },
              } as any,
            );
          } catch (err) {
            try {
              await this.bot.telegram.editMessageReplyMarkup(
                chatId,
                messageId,
                undefined,
                { inline_keyboard },
              );
            } catch {
              try {
                await this.bot.telegram.sendMessage(chatId, statusText);
              } catch (sendErr) {
                this.logger.log(
                  `Fallback send failed chat=${chatId}: ${(sendErr as Error).message}`,
                  'OrderBot',
                );
              }
            }
          }
        }),
      );

      this.logger.log(
        `Order ${order.id} ${action} by chat=${ctx.chat?.id}`,
        'OrderBot',
      );

      return successRes(order, 200, statusText);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async sendMessageToCreateGroup(groupId: string | null, message: string) {
    try {
      if (!groupId) {
        throw new BadRequestException('Group not found');
      }
      await this.bot.telegram.sendMessage(groupId, message, {
        parse_mode: 'Markdown',
      });
      return { success: true, message: 'Message sent successfully' };
    } catch (error) {
      return { success: false, message: (error as Error).message || 'error' };
    }
  }

  checkTokenRateLimit(userId: number): boolean {
    return !this.isTokenRateLimited(userId);
  }

  shareContact() {
    return {
      keyboard: [[{ text: '📞 Raqamni ulashish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  }

  openWebApp() {
    const url = this.resolveWebAppUrl();
    return {
      inline_keyboard: [
        [
          {
            text: '🛍️ Buyurtma yaratish',
            web_app: { url },
          },
        ],
      ],
    };
  }

  openWebAppbtn() {
    return {
      keyboard: [[{ text: '➕ Yangi buyurtma' }]],
      resize_keyboard: true,
    };
  }
}
