import {
  Ctx,
  Hears,
  Help,
  InjectBot,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
import { NarrowedContext, Telegraf } from 'telegraf';
import {
  Message,
  Update as TgUpdate,
} from 'telegraf/typings/core/types/typegram';
import { OrderBotService } from './order-bot.service';
import { MyContext } from './session.interface';
import config from 'src/config';

const TOKEN_REGEX = /^group_token-.+/i;

const getHttpStatus = (err: unknown): number => {
  const candidate =
    (err as { getStatus?: () => number; status?: number }) || {};
  if (typeof candidate.getStatus === 'function') {
    try {
      return candidate.getStatus();
    } catch {
      /* ignore */
    }
  }
  return typeof candidate.status === 'number' ? candidate.status : 500;
};

const getErrorMessage = (err: unknown): string => {
  if (!err) return "Noma'lum xatolik";
  const anyErr = err as { message?: string; response?: { message?: string } };
  return anyErr.response?.message || anyErr.message || "Noma'lum xatolik";
};

@Update()
export class OrderBotUpdate {
  constructor(
    @InjectBot(config.ORDER_BOT_NAME) private readonly bot: Telegraf<MyContext>,
    private readonly orderBotService: OrderBotService,
  ) {}

  @Start()
  async start(@Ctx() ctx: MyContext) {
    ctx.session.step = 'initial';
    ctx.session.waitingForPhone = false;

    if (ctx.chat?.type === 'private') {
      try {
        const response = await this.orderBotService.signInWithTelegram(ctx);

        if (`${response.statusCode}`.startsWith('2')) {
          ctx.session.step = 'ready';
          try {
            await ctx.reply('👋 Salom! Buyurtma yaratishga tayyorsiz.', {
              reply_markup: this.orderBotService.openWebApp(),
            });
            await ctx.reply('Quyidagi tugma orqali qaytadan oching:', {
              reply_markup: this.orderBotService.openWebAppbtn(),
            });
          } catch {
            await ctx.reply(
              "WebApp manzili sozlanmagan. Admin bilan bog'laning.",
            );
          }
          return;
        }
      } catch (error) {
        const status = getHttpStatus(error);
        if (status === 403) {
          await ctx.reply(`⛔ ${getErrorMessage(error)}`);
          return;
        }
        if (status !== 404 && status !== 400) {
          await ctx.reply(`❌ ${getErrorMessage(error)}`);
        }
      }

      ctx.session.step = 'waiting_for_token';
      await ctx.reply(
        '👋 Salom! Men Beepost buyurtma boti.\n\n' +
          'Boshlash uchun platformadagi *market tokenini* yuboring ' +
          '(format: `group_token-...`).',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
      await ctx.reply(
        '👋 Salom! Men Beepost buyurtma boti.\n\n' +
          'Ushbu guruhni buyurtmalar uchun ulash uchun platformadagi tokenni yuboring ' +
          '(format: `group_token-...`).',
        { parse_mode: 'Markdown' },
      );
    }
  }

  @Help()
  async help(@Ctx() ctx: MyContext) {
    await ctx.reply(
      '🤖 *Beepost Buyurtma Boti*\n\n' +
        '*Komandalar:*\n' +
        '/start — botni ishga tushirish\n' +
        '/help — yordam\n\n' +
        '*Shaxsiy chatda:*\n' +
        '1) `group_token-...` yuboring\n' +
        '2) Telefon raqamingizni ulashing\n' +
        '3) WebApp tugmasi orqali buyurtma yarating\n\n' +
        '*Guruhda:*\n' +
        '1) Tokenni yuboring — guruh buyurtma xabarnomalari uchun ulanadi\n' +
        '2) Xabarlardagi ✅/❌ tugmalari orqali buyurtmani tasdiqlang yoki bekor qiling',
      { parse_mode: 'Markdown' },
    );
  }

  @Hears(TOKEN_REGEX)
  async activateBot(
    @Ctx()
    ctx: NarrowedContext<
      MyContext,
      TgUpdate.MessageUpdate<Message.TextMessage>
    >,
  ) {
    const text = ctx.message.text;
    const isPrivate = ctx.chat?.type === 'private';
    const isGroup =
      ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

    if (isPrivate && ctx.from?.id) {
      if (!this.orderBotService.checkTokenRateLimit(ctx.from.id)) {
        await ctx.reply(
          "⏳ Juda ko'p urinishlar. 1 daqiqadan so'ng qayta urinib ko'ring.",
        );
        return;
      }
    }

    try {
      if (isPrivate) {
        const response = await this.orderBotService.checkToken(text, ctx);
        const market = response.data as
          | { id: string; name: string; add_order?: boolean }
          | undefined;

        if (!market?.id) {
          await ctx.reply("❌ Token noto'g'ri.");
          return;
        }

        ctx.session.marketData = {
          id: market.id,
          name: market.name,
          add_order: market.add_order,
        };
        ctx.session.step = 'waiting_for_phone';
        ctx.session.waitingForPhone = true;
        ctx.session.userId = ctx.from?.id;
        ctx.session.chatId = ctx.chat?.id;
        ctx.session.name = ctx.from?.first_name;

        await ctx.reply(
          `✅ Market topildi: *${market.name}*\n\n` +
            '📞 Iltimos, pastdagi tugma orqali telefon raqamingizni ulashing:',
          {
            parse_mode: 'Markdown',
            reply_markup: this.orderBotService.shareContact(),
          },
        );
        return;
      }

      if (isGroup) {
        const response = await this.orderBotService.addToGroup(text, ctx);
        await ctx.reply(response.message || '✅ Guruh ulandi.');
      }
    } catch (error) {
      await ctx.reply(`❌ ${getErrorMessage(error)}`);
    }
  }

  @On('contact')
  async registerOperator(
    @Ctx()
    ctx: NarrowedContext<
      MyContext,
      TgUpdate.MessageUpdate<Message.ContactMessage>
    >,
  ) {
    if (ctx.chat?.type !== 'private') return;

    try {
      if (!ctx.session.waitingForPhone || !ctx.session.marketData) {
        await ctx.reply(
          '❌ Avval market tokenini yuboring, keyin raqamingizni ulashing.',
        );
        return;
      }

      const contact = ctx.message.contact;

      if (contact.user_id !== ctx.from?.id) {
        await ctx.reply("❌ Iltimos, o'zingizning raqamingizni ulashing.", {
          reply_markup: this.orderBotService.shareContact(),
        });
        return;
      }

      const response = await this.orderBotService.registerNewOperator(
        contact.phone_number,
        ctx,
      );

      ctx.session.step = 'ready';
      ctx.session.waitingForPhone = false;
      ctx.session.phoneNumber = contact.phone_number;

      await ctx.reply(response.message, {
        reply_markup: { remove_keyboard: true },
      });

      try {
        await ctx.reply('🛍️ Endi buyurtma yaratishga tayyorsiz.', {
          reply_markup: this.orderBotService.openWebApp(),
        });
        await ctx.reply(
          'Keyingi safar shu tugma orqali tezda ochishingiz mumkin:',
          { reply_markup: this.orderBotService.openWebAppbtn() },
        );
      } catch {
        await ctx.reply("WebApp manzili sozlanmagan. Admin bilan bog'laning.");
      }
    } catch (error) {
      await ctx.reply(`❌ ${getErrorMessage(error)}`);
    }
  }

  @Hears(['➕ Yangi buyurtma', '➕ Add order'])
  async onAddOrder(@Ctx() ctx: MyContext) {
    try {
      await ctx.reply('🛍️ Buyurtma yaratish:', {
        reply_markup: this.orderBotService.openWebApp(),
      });
    } catch (err) {
      await ctx.reply("WebApp manzili sozlanmagan. Admin bilan bog'laning.");
    }
  }

  @On('callback_query')
  async onCallback(@Ctx() ctx: MyContext) {
    const callback = ctx.callbackQuery as { data?: string } | undefined;
    const data = callback?.data ? String(callback.data) : '';

    if (!data.startsWith('order:')) {
      await ctx.answerCbQuery();
      return;
    }

    const [, action, orderId] = data.split(':');

    if (action === 'status') {
      await ctx.answerCbQuery();
      return;
    }

    if (!action || !orderId) {
      await ctx.answerCbQuery("Noto'g'ri buyruq", { show_alert: true });
      return;
    }

    if (action !== 'approve' && action !== 'cancel') {
      await ctx.answerCbQuery("Noma'lum amal", { show_alert: true });
      return;
    }

    try {
      const response = await this.orderBotService.processOrderAction(
        action,
        orderId,
        ctx,
      );

      await ctx.answerCbQuery(response.message || '✅', { show_alert: false });
    } catch (error) {
      await ctx.answerCbQuery(getErrorMessage(error), { show_alert: true });
    }
  }
}
