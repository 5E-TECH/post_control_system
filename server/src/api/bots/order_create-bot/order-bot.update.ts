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
import { AiOrderService } from './ai-order.service';
import { MyContext, AiOrderDraft } from './session.interface';
import config from 'src/config';

const TOKEN_REGEX = /^group_token-.+/i;
const BUTTON_LABELS = ['➕ Yangi buyurtma', '➕ Add order'];

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
  // Foydalanuvchi bo'yicha qayta-kirish qulfi: bir vaqtda kelgan bir nechta
  // erkin matn parallel Claude chaqiruvi qilib draftni ustma-ust yozmasligi
  // uchun. JS bir oqimli — has()+add() await'siz atomik.
  private readonly aiBusy = new Set<number>();

  constructor(
    @InjectBot(config.ORDER_BOT_NAME) private readonly bot: Telegraf<MyContext>,
    private readonly orderBotService: OrderBotService,
    private readonly aiOrderService: AiOrderService,
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

  // ─── AI orqali buyurtma yaratish (erkin matn) ───
  // MUHIM: bu handler @Hears(TOKEN)/@Hears(tugma) dan KEYIN turadi, shuning uchun
  // token va tugma matnlari ularga tushadi; qolgan erkin matn AI'ga keladi.
  @On('text')
  async onAiText(@Ctx() ctx: MyContext) {
    if (ctx.chat?.type !== 'private') return;

    const message = ctx.message as Message.TextMessage | undefined;
    const text = message && 'text' in message ? message.text.trim() : '';
    if (!text || text.startsWith('/')) return;
    if (TOKEN_REGEX.test(text)) return; // @Hears(TOKEN_REGEX) ishlaydi
    if (BUTTON_LABELS.includes(text)) return; // @Hears(tugma) ishlaydi
    if (!this.aiOrderService.isEnabled()) return; // AI o'chiq — WebApp ishlaydi

    const step = ctx.session.step;
    if (
      step !== 'ready' &&
      step !== 'collecting' &&
      step !== 'confirming' &&
      step !== 'clarifying'
    ) {
      return;
    }

    const uid = ctx.from?.id;
    if (uid == null) return;

    // Qayta-kirish qulfi (has+add await'dan OLDIN — atomik)
    if (this.aiBusy.has(uid)) {
      await ctx.reply("⏳ Oldingi xabaringiz o'qilmoqda, biroz kuting...");
      return;
    }
    this.aiBusy.add(uid);

    try {
      const operator = await this.aiOrderService.resolveOperator(uid);
      if (!operator) return; // ro'yxatdan o'tmagan — jim

      // Davomi (collecting) — yetishmayotgan ma'lumot so'ralgach kelgan xabar
      // avvalgi matnga QO'SHILADI; aks holda yangi buyurtma boshlanadi.
      if (step === 'collecting' && ctx.session.draft_raw) {
        ctx.session.draft_raw = `${ctx.session.draft_raw}\n${text}`;
      } else {
        ctx.session.draft_raw = text;
        ctx.session.draft_attempts = 0;
        ctx.session.order_draft = undefined;
      }

      try {
        await ctx.sendChatAction('typing');
      } catch {
        /* ignore */
      }

      let draft: AiOrderDraft | null;
      try {
        draft = await this.aiOrderService.extractDraft(ctx.session.draft_raw);
      } catch {
        draft = null;
      }
      if (!draft) {
        await this.handleIncomplete(ctx, [], true); // AI xatosi
        return;
      }

      await this.aiOrderService.resolveDraft(draft, operator.marketId);

      const missing = this.aiOrderService.missingRequired(draft);
      if (missing.length) {
        await this.handleIncomplete(ctx, missing, false);
        return;
      }

      // To'liq — to'plash holatini tozalab, kartani (clarify/confirm) ko'rsatamiz
      ctx.session.draft_raw = undefined;
      ctx.session.draft_attempts = 0;
      ctx.session.order_draft = draft;
      const view = this.nextDraftView(ctx);
      await ctx.reply(view.text, {
        parse_mode: view.markdown ? 'Markdown' : undefined,
        reply_markup: view.keyboard,
      });
    } finally {
      this.aiBusy.delete(uid);
    }
  }

  // To'liqsiz/xato urinish: yetishmagan maydonlarni SO'RAB davom etamiz; faqat
  // 3 marta ketma-ket to'liqsiz/xato bo'lsa WebApp formasini beramiz.
  private async handleIncomplete(
    ctx: MyContext,
    missing: string[],
    isAiError: boolean,
  ): Promise<void> {
    const attempts = (ctx.session.draft_attempts ?? 0) + 1;
    ctx.session.draft_attempts = attempts;

    if (attempts >= 3) {
      // 3-marta — endi WebApp; holatni tozalaymiz
      ctx.session.step = 'ready';
      ctx.session.draft_raw = undefined;
      ctx.session.draft_attempts = 0;
      ctx.session.order_draft = undefined;
      await ctx.reply(
        (isAiError
          ? "🤖 Bir necha marta o'qib bo'lmadi."
          : `🤖 Hali ham yetishmayapti: ${missing.join(', ')}.`) +
          "\nIltimos, WebApp formasidan to'ldiring.",
        { reply_markup: this.orderBotService.openWebApp() },
      );
      return;
    }

    // < 3 — yetishgan ma'lumotni so'rab, avvalgisini saqlab davom etamiz
    ctx.session.step = 'collecting';
    const msg = isAiError
      ? "🤖 Xabarni o'qiy olmadim. Buyurtmani qayta yozib yuboring."
      : `📝 Yana kerak: ${missing.join(', ')}.\n` +
        "Shu ma'lumotni yozib yuboring (avvalgisi saqlanadi).";
    await ctx.reply(msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Bekor', callback_data: 'order_ai:cancelcollect' }],
        ],
      },
    });
  }

  // Draftni keyingi holatga o'tkazib, ko'rsatiladigan matn+tugmalarni beradi.
  private nextDraftView(ctx: MyContext): {
    text: string;
    keyboard: { inline_keyboard: { text: string; callback_data: string }[][] };
    markdown: boolean;
  } {
    const draft = ctx.session.order_draft as AiOrderDraft;
    const next = this.aiOrderService.firstUnresolved(draft);
    if (next?.type === 'district') {
      ctx.session.step = 'clarifying';
      const v = this.aiOrderService.buildDistrictClarify(draft);
      return { text: v.text, keyboard: v.keyboard, markdown: false };
    }
    if (next?.type === 'item') {
      ctx.session.step = 'clarifying';
      const v = this.aiOrderService.buildItemClarify(
        draft,
        next.itemIndex as number,
      );
      return { text: v.text, keyboard: v.keyboard, markdown: false };
    }
    ctx.session.step = 'confirming';
    const v = this.aiOrderService.buildConfirmCard(draft);
    // Karta plain text (Markdown injeksiyasidan xoli)
    return { text: v.text, keyboard: v.keyboard, markdown: false };
  }

  private async handleAiCallback(ctx: MyContext, data: string) {
    // format: order_ai:<action>:<nonce>[:<a3>[:<a4>]]
    const [, action, nonce, a3, a4] = data.split(':');

    // To'plash (collecting) bekori — bu bosqichda draft/nonce hali yo'q,
    // shuning uchun nonce tekshiruvidan OLDIN alohida ishlanadi.
    if (action === 'cancelcollect') {
      ctx.session.draft_raw = undefined;
      ctx.session.draft_attempts = 0;
      ctx.session.order_draft = undefined;
      ctx.session.step = 'ready';
      try {
        await ctx.editMessageText('❌ Bekor qilindi.');
      } catch {
        /* ignore */
      }
      await ctx.answerCbQuery();
      return;
    }

    const draft = ctx.session.order_draft;

    // Eskirgan karta (draft almashtirilgan yoki yo'q) — nonce mos kelmasa rad
    // etiladi, aks holda eski karta NOTO'G'RI (joriy) buyurtmani yaratardi.
    if (!draft || !draft.nonce || draft.nonce !== nonce) {
      await ctx.answerCbQuery('⏳ Bu buyurtma eskirgan.', { show_alert: true });
      return;
    }

    if (action === 'cancel') {
      ctx.session.order_draft = undefined;
      ctx.session.step = 'ready';
      try {
        await ctx.editMessageText('❌ Buyurtma bekor qilindi.');
      } catch {
        /* ignore */
      }
      await ctx.answerCbQuery();
      return;
    }

    if (action === 'pickdistrict') {
      const c = draft.district_candidates?.[Number(a3)];
      if (c) {
        draft.district_id = c.id;
        draft.district_label = c.label;
        draft.district_candidates = undefined;
      }
      await this.editDraftView(ctx);
      await ctx.answerCbQuery();
      return;
    }

    if (action === 'pickproduct') {
      const item = draft.items[Number(a3)];
      const c = item?.candidates?.[Number(a4)];
      if (item && c) {
        item.product_id = c.id;
        item.resolved_name = c.name;
        item.candidates = undefined;
      }
      await this.editDraftView(ctx);
      await ctx.answerCbQuery();
      return;
    }

    if (action === 'confirm') {
      const operator = await this.aiOrderService.resolveOperator(ctx.from?.id);
      if (!operator) {
        await ctx.answerCbQuery("Ruxsat yo'q.", { show_alert: true });
        return;
      }
      let result: { ok: boolean; message: string };
      try {
        result = await this.aiOrderService.commit(draft, operator);
      } catch (e) {
        result = { ok: false, message: `❌ ${getErrorMessage(e)}` };
      }
      ctx.session.order_draft = undefined;
      ctx.session.step = 'ready';
      try {
        await ctx.editMessageText(result.message);
      } catch {
        /* ignore */
      }
      await ctx.answerCbQuery(result.ok ? '✅' : '❌');
      return;
    }

    await ctx.answerCbQuery();
  }

  private async editDraftView(ctx: MyContext) {
    const view = this.nextDraftView(ctx);
    try {
      await ctx.editMessageText(view.text, {
        parse_mode: view.markdown ? 'Markdown' : undefined,
        reply_markup: view.keyboard,
      });
    } catch {
      /* ignore edit errors */
    }
  }

  @On('callback_query')
  async onCallback(@Ctx() ctx: MyContext) {
    const callback = ctx.callbackQuery as { data?: string } | undefined;
    const data = callback?.data ? String(callback.data) : '';

    if (data.startsWith('order_ai:')) {
      try {
        await this.handleAiCallback(ctx, data);
      } catch {
        // eskirgan/xato callback query — jimgina yopamiz
        try {
          await ctx.answerCbQuery();
        } catch {
          /* ignore */
        }
      }
      return;
    }

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
