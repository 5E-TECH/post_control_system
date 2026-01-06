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
import { Group_type, Order_status, Roles, Status } from 'src/common/enums';
import config from 'src/config';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { MyLogger } from 'src/logger/logger.service';

@Injectable()
export class OrderBotService {
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

  private statusButtonLabel(order: OrderEntity) {
    const status = order.deleted
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

  private formatPrice(value: number | string) {
    const numeric = Number(value) || 0;
    return numeric.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  async syncStatusButton(orderId: string) {
    try {
      const order = await this.orderRepo.findOne({
        where: { id: orderId },
      });

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
          } catch (error) {
            // fallback: ignore
          }
        }),
      );
    } catch (error) {
      // silent fail
    }
  }

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
          where: { group_id: groupId, group_type: Group_type.CREATE },
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
        group_type: Group_type.CREATE,
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
      // token ishlatilgan hisoblanadi
      try {
        const market = await this.userRepo.findOne({
          where: { market_tg_token: text },
        });
        if (market) {
          const telegram_token = 'group_token-' + generateCustomToken();
          market.market_tg_token = telegram_token;
          await this.userRepo.save(market);
        }
      } catch (_) {
        // ignore
      }
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

      const telegram_token = 'group_token-' + generateCustomToken();
      market.market_tg_token = telegram_token;
      await queryRunner.manager.save(market);
      await queryRunner.commitTransaction();

      return successRes(
        market,
        200,
        `${market.name} uchun operator ro'yxatdan o'tmoqchi`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // token ishlatilgan hisoblanadi
      try {
        const market = await this.userRepo.findOne({
          where: { market_tg_token: text },
        });
        if (market) {
          const telegram_token = 'group_token-' + generateCustomToken();
          market.market_tg_token = telegram_token;
          await this.userRepo.save(market);
        }
      } catch (_) {
        // ignore
      }
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
      const contact = phone_number.startsWith('+')
        ? phone_number
        : `+${phone_number}`;
      const isExistUser = await queryRunner.manager.findOne(UserEntity, {
        where: {
          phone_number: contact,
          is_deleted: false,
        },
      });
      if (isExistUser?.status === Status.INACTIVE) {
        throw new BadRequestException('Sorry you have blocked!');
      }
      if (isExistUser) {
        return successRes(
          {},
          200,
          `Siz ushbu platformada allaqachon ${isExistUser.role} sifatida ro'yxatdan o'tgansiz`,
        );
      }
      const hashedPassword = await this.bcrypt.encrypt(config.ADMIN_PASSWORD);
      const operator = queryRunner.manager.create(UserEntity, {
        name: ctx.session.name,
        phone_number: contact,
        password: hashedPassword,
        role: Roles.OPERATOR,
        add_order: ctx.session.marketData.add_order,
        market_id: ctx.session.marketData.id,
        telegram_id: ctx.from?.id,
      });

      await queryRunner.manager.save(operator);
      await queryRunner.commitTransaction();
      return successRes(
        operator,
        201,
        "Siz Beepost platoformasida muvofaqiyatli ro'yxatdan o'tdingiz! Pastdagi tugma orqali buyurtma yaratishingiz mumkin!",
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
      const user = await this.userRepo.findOne({
        where: { telegram_id: ctx.from?.id },
      });
      this.logger.log('Singning in user: ', `${user}`);
      if (!user) {
        throw new NotFoundException("Siz platformadan ro'yxatdan o'tmagansiz!");
      }
      if (user.status === Status.INACTIVE) {
        throw new BadRequestException('Siz ushbu platformadan blocklangansiz');
      }
      if (user.role !== Roles.OPERATOR) {
        throw new BadRequestException(
          "Kechirasiz siz operator sifatida ro'yxardan o'tmagansiz",
        );
      }
      const { id, role, status } = user;
      const payload: JwtPayload = { id, role, status };
      const accessToken = await this.token.generateAccessToken(payload);
      this.logger.log('Access token with Telegram: ', accessToken);
      return successRes(
        { access_token: accessToken, user },
        200,
        'Logged in successfully',
      );
    } catch (error) {
      this.logger.log('Telegram sign in Error: ', error);
      return catchError(error);
    }
  }

  private buildOrderMessage(order: OrderEntity) {
    const customerDistrict = order.customer?.district;
    const regionName = customerDistrict?.region?.name;
    const districtName = customerDistrict?.name;
    const addressLine =
      regionName && districtName
        ? `${regionName}, ${districtName}`
        : districtName || regionName || '-';

    const itemsText = order.items
      ?.map(
        (item, i) =>
          `   ${i + 1}. ${item.product?.name || '-'} — ${item.quantity} dona`,
      )
      .join('\n');

    return (
      `*✅ Yangi buyurtma!*\n\n` +
      `👤 *Mijoz:* ${order.customer?.name || '-'}\n` +
      `📞 *Telefon:* ${order.customer?.phone_number || '-'}\n` +
      `📍 *Manzil:* ${addressLine}\n\n` +
      `📦 *Buyurtmalar:*\n${itemsText || '-'}\n\n` +
      `💰 *Narxi:* ${this.formatPrice(order.total_price)} so‘m\n` +
      `🕒 *Yaratilgan vaqti:* ${new Date(
        Number(order.created_at),
      ).toLocaleString('uz-UZ')}\n\n` +
      `🧑‍💻 *Operator:* ${order.operator || '-'}\n\n` +
      `📝 *Izoh:* ${order.comment || '-'}\n`
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
      const message =
        error?.response?.message ||
        error?.message ||
        'Noma’lum xatolik yuz berdi';
      return { success: false, message: message || 'error' };
    }
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
        throw new NotFoundException('Order not found');
      }

      if (order.deleted || order.status !== Order_status.CREATED) {
        return successRes(order, 200, 'Order already processed');
      }

      if (action === 'approve') {
        order.status = Order_status.NEW;
      } else {
        order.deleted = true;
      }

      await queryRunner.manager.save(order);
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
              await this.bot.telegram.sendMessage(chatId, statusText);
            }
          }
        }),
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

  openWebApp() {
    const webAppUrl = config.WEB_APP_URL?.replace(/\/$/, '') || '';

    this.logger.log('Web App url: ', webAppUrl);
    // const url =
    //   webAppUrl && !webAppUrl.endsWith('/bot')
    //     ? `${webAppUrl}/bot`
    //     : webAppUrl || 'https://beepost.uz/admin/bot';

    const url = 'https://beepost.uz/admin/bot';

    this.logger.log('Custom url: ', url);

    const webAppButton = {
      inline_keyboard: [
        [
          {
            text: '🚀 WebAppni ochish',
            web_app: {
              url,
            },
          },
        ],
      ],
    };
    return webAppButton;
  }

  openWebAppbtn() {
    const webAppButton = {
      keyboard: [[{ text: '➕ Add order' }]],
      resize_keyboard: true,
      // one_time_keyboard: true,
    };
    return webAppButton;
  }

  remove(id: number) {
    return `This action removes a #${id} bot`;
  }
}
