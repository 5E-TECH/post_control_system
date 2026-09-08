import {
  Command,
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
import { randomBytes } from 'crypto';
import { OrderBotService } from './order-bot.service';
import {
  AiOrderService,
  OrderPreview,
  PRICE_CONFIRM_THRESHOLD,
  ResolvedOperator,
} from './ai-order.service';
import { AiBalanceService } from 'src/api/ai-balance/ai-balance.service';
import { MyContext, AiOrderDraft } from './session.interface';
import { ClaudeImageInput } from 'src/infrastructure/ai/claude.service';
import { MyLogger } from 'src/logger/logger.service';
import config from 'src/config';

const TOKEN_REGEX = /^group_token-.+/i;
const BUTTON_LABELS = ['➕ Yangi buyurtma', '➕ Add order'];
// Rasm hajmi chegarasi — Claude ~5MB/rasm limiti (DoS/xarajat himoyasi).
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
// Claude vision qo'llaydigan rasm formatlari (rasm-hujjat mime tekshiruvi uchun).
const CLAUDE_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

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
    private readonly aiBalanceService: AiBalanceService,
    private readonly logger: MyLogger,
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
    // Faqat ro'yxatdan o'tish bosqichlarida (token/telefon kutilayotganda) erkin
    // matnni AI'ga BERMAYMIZ — u yerda matn boshqa ma'noga ega. Boshqa har qanday
    // holatda (ready / undefined / restart'dan keyingi 'initial' / fixing) davom
    // etamiz. MUHIM: sessiya XOTIRADA — server qayta ishga tushsa 'initial'ga
    // tiklanadi; agar bu yerda 'initial'ni bloklasak, ro'yxatdan o'tgan operator
    // har restart'dan keyin /start bosishga majbur bo'lardi. Ro'yxatdan
    // o'tmaganini pastdagi resolveOperator jimgina to'xtatadi.
    if (step === 'waiting_for_token' || step === 'waiting_for_phone') {
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

      // ── Bot ichida tuzatish rejimi: kelgan matn joriy buyurtmaning
      // tuzatilayotgan maydoniga tegishli (yangi buyurtma tahlili EMAS).
      if (ctx.session.step === 'fixing' && ctx.session.fixing) {
        await this.applyFix(ctx, text, operator);
        return;
      }

      await this.runAiParse(ctx, operator, text);
    } finally {
      this.aiBusy.delete(uid);
    }
  }

  // Matn YOKI rasm(lar)dan buyurtma(lar)ni tahlil qilib, preview kartalarni
  // ko'rsatadi. onAiText (matn) va onAiPhoto (rasm) shu yagona oqimni ishlatadi.
  // Chaqiruvchi aiBusy qulfini boshqaradi (bu metod qulfga tegmaydi).
  private async runAiParse(
    ctx: MyContext,
    operator: ResolvedOperator,
    text: string,
    images?: ClaudeImageInput[],
  ) {
    try {
      await ctx.sendChatAction('typing');
    } catch {
      /* ignore */
    }

    // Ko'rinadigan loading — AI o'qiyotganini bildirish uchun (parse tugagach
    // o'chiriladi). sendChatAction('typing') ~5s'dan keyin so'nadi, bu esa
    // javob kelguncha turadi.
    let loadingMsgId: number | undefined;
    try {
      const m = await ctx.reply('🤖 AI buyurtmalarni o\'qimoqda, biroz kuting…');
      loadingMsgId = m.message_id;
    } catch {
      /* ignore */
    }

    // ── Ko'p-buyurtma tahlil (platformadagi bilan bir xil oqim).
    // Matn/rasmdan bir yoki bir nechta buyurtma ajratiladi; pul PARSE'da EMAS,
    // har YARATILGAN buyurtma uchun "✅ Yaratish" bosilganda yechiladi.
    const res = await this.aiOrderService.parseForUser(
      text,
      operator.jwt,
      operator.marketId,
      images,
    );

    // Loading'ni o'chiramiz (natija — karta yoki xato — endi ko'rsatiladi).
    if (loadingMsgId != null) {
      try {
        await ctx.deleteMessage(loadingMsgId);
      } catch {
        /* ignore */
      }
    }

    if (!res.ok) {
      const webApp = { reply_markup: this.orderBotService.openWebApp() };
      if (res.reason === 'insufficient') {
        await ctx.reply(
          `💳 AI balans yetarli emas (kerak: ${this.formatSom(
            res.price || 0,
          )} so'm, qoldi: ${this.formatSom(res.balance || 0)} so'm).\n` +
            "To'lov qilib qayta urinib ko'ring yoki WebApp formasidan foydalaning.",
          webApp,
        );
      } else if (res.reason === 'disabled' || res.reason === 'ai_off') {
        await ctx.reply(
          '🤖 Bu market uchun AI yoqilmagan. Iltimos, WebApp formasidan foydalaning.',
          webApp,
        );
      } else if (res.reason === 'ai_error') {
        await ctx.reply(
          '🤖 AI hozir javob bera olmadi. Biroz kutib qayta yuboring yoki WebApp formasidan foydalaning.',
          webApp,
        );
      } else {
        await ctx.reply(
          "❌ Buyurtmani o'qib bo'lmadi. WebApp formasidan foydalaning.",
          webApp,
        );
      }
      return;
    }

    const previews = res.orders || [];
    if (!previews.length) {
      await ctx.reply(
        images?.length
          ? '🤖 Rasmdan buyurtma topilmadi. Rasm aniqroq bo\'lsin yoki mijoz ismi, telefon, manzil, mahsulot va narxni yozing.'
          : '🤖 Matndan buyurtma topilmadi. Mijoz ismi, telefon, manzil, mahsulot va narxni yozing.',
        { reply_markup: this.orderBotService.openWebApp() },
      );
      return;
    }

    // Kartalar keyingi "✅ Yaratish" bosilganda ishlatiladi — session'da saqlaymiz.
    // previews_nonce eski kartalardan (yangi tahlildan keyin) yaratishni bloklaydi.
    const nonce = randomBytes(4).toString('hex');
    ctx.session.order_previews = previews;
    ctx.session.previews_nonce = nonce;
    ctx.session.step = 'ready';
    // Eski bir-buyurtma oqimi qoldiqlarini tozalaymiz (chalkashmasin).
    ctx.session.order_draft = undefined;
    ctx.session.draft_raw = undefined;

    for (let i = 0; i < previews.length; i++) {
      const p = previews[i];
      const cardText = this.formatBotCard(p, i, previews.length);
      await ctx.reply(cardText, {
        reply_markup: this.cardKeyboard(p.ready, nonce, i),
      });
    }

    // Jonli xulosa — har tasdiq/tuzatishdan keyin YANGILANADI (id saqlanadi).
    const summaryText = await this.buildSummaryText(previews, operator.marketId);
    const sm = await ctx.reply(summaryText);
    ctx.session.summary_msg_id = sm.message_id;
  }

  // ── RASM orqali buyurtma: foydalanuvchi rasm (buyurtma varag'i / skrinshot)
  // tashlasa, Claude vision undagi matnni o'qib buyurtma(lar)ni ajratadi.
  // Har rasm ALOHIDA xabar bo'lib keladi (albom bo'lsa har biri alohida parse).
  @On('photo')
  async onAiPhoto(@Ctx() ctx: MyContext) {
    if (ctx.chat?.type !== 'private') return;
    if (!this.aiOrderService.isEnabled()) return; // AI o'chiq — WebApp ishlaydi

    const step = ctx.session.step;
    // Matndagi kabi: token/telefon kutilayotganda rasmni AI'ga bermaymiz.
    if (step === 'waiting_for_token' || step === 'waiting_for_phone') return;

    const message = ctx.message as Message.PhotoMessage | undefined;
    const photos = message?.photo;
    if (!photos?.length) return;
    const caption =
      message && 'caption' in message ? (message.caption || '').trim() : '';

    const uid = ctx.from?.id;
    if (uid == null) return;

    if (this.aiBusy.has(uid)) {
      await ctx.reply("⏳ Oldingi xabaringiz o'qilmoqda, biroz kuting...");
      return;
    }
    this.aiBusy.add(uid);

    try {
      const operator = await this.aiOrderService.resolveOperator(uid);
      if (!operator) return; // ro'yxatdan o'tmagan — jim

      // Limit ostidagi ENG KATTA o'lchamni tanlaymiz (Claude ~5MB/rasm limiti).
      const sorted = [...photos].sort(
        (a, b) => (b.file_size || 0) - (a.file_size || 0),
      );
      const chosen =
        sorted.find((p) => (p.file_size || 0) <= PHOTO_MAX_BYTES) || sorted.at(-1);
      if (!chosen) return;

      const image = await this.downloadTelegramImage(ctx, chosen.file_id);
      if (!image) {
        await ctx.reply(
          "🤖 Rasmni yuklab bo'lmadi. Qayta yuboring yoki matn bilan yozing.",
          { reply_markup: this.orderBotService.openWebApp() },
        );
        return;
      }

      await this.runAiParse(ctx, operator, caption, [image]);
    } finally {
      this.aiBusy.delete(uid);
    }
  }

  // ── RASM HUJJAT sifatida (siqilmasдan) yuborilsa. Oddiy surat Telegram
  // tomonidan avtomatik siqiladi (kichik keladi); hujjat esa asl/katta bo'lishi
  // mumkin. Yaroqli format + <=5MB bo'lsa qabul qilamiz; katta yoki Claude
  // qo'llamaydigan format (HEIC va h.k.) bo'lsa — SURAT sifatida yuborishni
  // so'raymiz (Telegram o'zi jpeg'ga siqib, kichraytirib beradi).
  @On('document')
  async onAiDocument(@Ctx() ctx: MyContext) {
    if (ctx.chat?.type !== 'private') return;
    if (!this.aiOrderService.isEnabled()) return;

    const step = ctx.session.step;
    if (step === 'waiting_for_token' || step === 'waiting_for_phone') return;

    const message = ctx.message as Message.DocumentMessage | undefined;
    const doc = message?.document;
    if (!doc) return;
    const mime = (doc.mime_type || '').toLowerCase();
    // Faqat rasm-hujjatlar bilan ishlaymiz; boshqa fayllarga (pdf, doc...) jim.
    if (!mime.startsWith('image/')) return;

    const caption =
      message && 'caption' in message ? (message.caption || '').trim() : '';
    const uid = ctx.from?.id;
    if (uid == null) return;

    // Claude qo'llaydigan formatlar. Boshqasi (masalan HEIC) -> surat sifatida so'raymiz.
    if (!CLAUDE_IMAGE_MIME.includes(mime)) {
      await ctx.reply(
        "🤖 Bu rasm formatini o'qiy olmadim. Iltimos rasmni 📷 SURAT sifatida (fayl sifatida emas) yuboring — u avtomatik moslashtiriladi.",
      );
      return;
    }
    // Katta hujjat: Telegram siqishига yo'naltiramiz (serverda kichraytirmaymiz).
    if ((doc.file_size || 0) > PHOTO_MAX_BYTES) {
      await ctx.reply(
        "🤖 Rasm katta (5MB dan oshiq). Iltimos uni 📷 SURAT sifatida yuboring — Telegram avtomatik kichraytiradi va o'qib beraman.",
      );
      return;
    }

    if (this.aiBusy.has(uid)) {
      await ctx.reply("⏳ Oldingi xabaringiz o'qilmoqda, biroz kuting...");
      return;
    }
    this.aiBusy.add(uid);

    try {
      const operator = await this.aiOrderService.resolveOperator(uid);
      if (!operator) return;

      const image = await this.downloadTelegramImage(
        ctx,
        doc.file_id,
        mime as ClaudeImageInput['mediaType'],
      );
      if (!image) {
        await ctx.reply(
          "🤖 Rasmni yuklab bo'lmadi. 📷 Surat sifatida yuboring yoki matn bilan yozing.",
          { reply_markup: this.orderBotService.openWebApp() },
        );
        return;
      }

      await this.runAiParse(ctx, operator, caption, [image]);
    } finally {
      this.aiBusy.delete(uid);
    }
  }

  // Telegram rasmini yuklab, Claude vision uchun base64 ClaudeImageInput qaytaradi.
  // Telegram siqilgan surati JPEG; rasm-hujjat (document) uchun mediaType beriladi.
  // Xato/katta bo'lsa null (chaqiruvchi xabar beradi).
  private async downloadTelegramImage(
    ctx: MyContext,
    fileId: string,
    mediaType: ClaudeImageInput['mediaType'] = 'image/jpeg',
  ): Promise<ClaudeImageInput | null> {
    try {
      const link = await ctx.telegram.getFileLink(fileId);
      const resp = await fetch(link.href);
      if (!resp.ok) throw new Error(`getFile HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      if (!buf.length || buf.length > PHOTO_MAX_BYTES) {
        throw new Error(`rasm hajmi mos emas (${buf.length} bayt)`);
      }
      return { mediaType, dataBase64: buf.toString('base64') };
    } catch (err) {
      this.logger.error(
        `Telegram rasm yuklash xatosi: ${(err as Error).message}`,
        undefined,
        'OrderBotUpdate',
      );
      return null;
    }
  }

  // Jonli xulosa matni: jami / yaratilgan / tayyor / kamchilikli + AI balans.
  // Bot foydalanuvchilari doim MARKET/OPERATOR (exempt emas) — balans doim ko'rsatiladi.
  private async buildSummaryText(
    previews: OrderPreview[],
    marketId: string,
  ): Promise<string> {
    const total = previews.length;
    const created = previews.filter((p) => p.created).length;
    const ready = previews.filter((p) => !p.created && p.ready).length;
    const deficient = total - created - ready;
    let text =
      `📋 Jami: ${total} ta buyurtma\n` +
      `✅ Yaratilgan: ${created} ta\n` +
      `🟢 Tayyor: ${ready} ta\n` +
      `⚠️ Kamchilikli: ${deficient} ta`;
    const state = await this.aiBalanceService.getState(marketId);
    if (state) {
      text +=
        `\n\n💳 AI balans: ${this.formatSom(state.balance)} so'm` +
        ` (har buyurtma: ${this.formatSom(state.price)} so'm)`;
    }
    return text;
  }

  // Yuqoridagi jonli xulosani (summary_msg_id) joyida yangilaydi.
  private async updateSummary(ctx: MyContext, marketId: string) {
    const previews = ctx.session.order_previews;
    const msgId = ctx.session.summary_msg_id;
    if (!previews || msgId == null || ctx.chat?.id == null) return;
    const text = await this.buildSummaryText(previews, marketId);
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, msgId, undefined, text);
    } catch {
      /* ignore (matn o'zgarmagan yoki eski) */
    }
  }

  // Bitta buyurtma preview'sini Telegram kartasi matniga aylantiradi (plain text
  // — Markdown injeksiyasidan xoli). Kamchiliklar aniq ro'yxat bilan ko'rsatiladi.
  private formatBotCard(p: OrderPreview, idx: number, total: number): string {
    const L: string[] = [];
    const head = total > 1 ? `📦 Buyurtma #${idx + 1}` : '📦 Buyurtma';
    L.push(p.customer_name ? `${head} — ${p.customer_name}` : head);
    L.push(`📞 ${p.phone_number || "❌ telefon yo'q"}`);
    if (p.extra_number) L.push(`➕ ${p.extra_number}`);
    const geo = [p.region_name, p.district_name].filter(Boolean).join(', ');
    L.push(`📍 ${geo || '❌ manzil aniqlanmagan'}`);
    if (p.address) L.push(`   ${p.address}`);

    if (!p.items.length) {
      L.push("🛒 ❌ mahsulot yo'q");
    } else {
      p.items.forEach((it) => {
        const name = it.resolved_name || it.name;
        const mark = it.product_id ? '✅' : it.candidates?.length ? '⚠️' : '❌';
        const note = it.product_id
          ? ''
          : it.candidates?.length
            ? ' (aniqlanmagan)'
            : " (katalogda yo'q)";
        L.push(`🛒 ${mark} ${it.quantity}× ${name}${note}`);
      });
    }

    L.push(
      p.total_price != null
        ? `💰 ${this.formatSom(p.total_price)} so'm`
        : "💰 ❌ narx yo'q",
    );
    if (p.operator) L.push(`👤 ${p.operator}`);

    L.push('');
    if (p.ready) {
      L.push('✅ Tayyor — yaratishga tayyor.');
    } else {
      // Kamchilikni KO'ZGA TASHLANADIGAN qilib ajratamiz (ajratuvchi + qizil
      // markerlar). "Tuzatish tugmasini bosing" izohi olib tashlandi — tugma
      // baribir pastda turibdi (ortiqcha yozuv).
      L.push('━━━━━━━━━━━━━━');
      L.push(`⚠️ TUZATISH KERAK — ${p.issues.length} ta kamchilik:`);
      p.issues.forEach((iss) => L.push(`🔴 ${iss}`));
      L.push('━━━━━━━━━━━━━━');
    }
    return L.join('\n');
  }

  // Karta tugmalari: tayyor -> "✅ Yaratish"; kamchilikli -> "✏️ Tuzatish"
  // (ikkalasi ham callback — WebApp emas, bot ichida ishlaydi).
  private cardKeyboard(ready: boolean, nonce: string, idx: number) {
    return {
      inline_keyboard: [
        [
          ready
            ? {
                text: '✅ Yaratish',
                callback_data: `order_ai:mkcreate:${nonce}:${idx}`,
              }
            : {
                text: '✏️ Tuzatish',
                callback_data: `order_ai:mkfix:${nonce}:${idx}`,
              },
        ],
      ],
    };
  }

  // Tugmalarni qatorlarga bo'ladi (viloyat/tuman ro'yxati ixcham chiqsin).
  private chunkButtons(
    btns: { text: string; callback_data: string }[],
    perRow: number,
  ): { text: string; callback_data: string }[][] {
    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < btns.length; i += perRow) {
      rows.push(btns.slice(i, i + perRow));
    }
    return rows;
  }

  // "550 000" / "550000" / "550 ming" / "2 mln" kabi narx matnini songa aylantiradi.
  private parsePriceInput(text: string): number | null {
    const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const numMatch = t.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    let base = parseFloat(numMatch);
    if (!isFinite(base)) return null;
    if (/\bmln\b|million|mil\b/.test(t)) base *= 1_000_000;
    else if (/\bming\b|\bmln\b|\bk\b/.test(t)) base *= 1000;
    return Math.round(base);
  }

  // Tuzatish so'rovi — matn + (ixtiyoriy nomzod tugmalari) + doim "❌ Bekor".
  // Chat toza qolishi uchun OLDINGI so'rovni o'chiradi va faqat joriysini qoldiradi.
  private async replyFix(
    ctx: MyContext,
    text: string,
    nonce: string,
    rows?: { text: string; callback_data: string }[][],
  ) {
    const fixing = ctx.session.fixing;
    if (fixing?.prompt_msg_id != null) {
      try {
        await ctx.deleteMessage(fixing.prompt_msg_id);
      } catch {
        /* ignore */
      }
    }
    // Noto'g'ri kiritish izohi bo'lsa — matn oldiga qo'shamiz (alohida "❌"
    // xabar EMAS — shунда chat toza qoladi).
    let full = text;
    if (fixing?.error_note) {
      full = `${fixing.error_note}\n${text}`;
      fixing.error_note = undefined;
    }
    const inline_keyboard = [
      ...(rows || []),
      [{ text: '❌ Bekor', callback_data: `order_ai:fixcancel:${nonce}` }],
    ];
    const m = await ctx.reply(full, { reply_markup: { inline_keyboard } });
    if (fixing) fixing.prompt_msg_id = m.message_id;
  }

  // Kartani ASL joyida (card_msg_id) yangilaydi; eski bo'lsa pastda yangi yuboradi.
  private async renderCardInPlace(
    ctx: MyContext,
    p: OrderPreview,
    idx: number,
    nonce: string,
    total: number,
    cardMsgId?: number,
  ) {
    const cardText = this.formatBotCard(p, idx, total);
    const kb = this.cardKeyboard(p.ready, nonce, idx);
    if (cardMsgId != null && ctx.chat?.id != null) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          cardMsgId,
          undefined,
          cardText,
          { reply_markup: kb },
        );
        return;
      } catch {
        /* karta juda eski — pastda yangi yuboramiz */
      }
    }
    await ctx.reply(cardText, { reply_markup: kb });
  }

  // Tuzatilayotgan buyurtmaning KEYINGI kamchiligini so'raydi; kamchilik
  // qolmasa — tayyor kartani "✅ Yaratish" tugmasi bilan ko'rsatadi.
  private async promptNextFix(ctx: MyContext, marketId: string) {
    const fixing = ctx.session.fixing;
    const previews = ctx.session.order_previews;
    if (!fixing || !previews) return;
    const p = previews[fixing.idx];
    if (!p) {
      ctx.session.fixing = undefined;
      ctx.session.step = 'ready';
      return;
    }
    this.aiOrderService.recomputePreview(p);
    const nonce = fixing.nonce;

    if (p.ready) {
      // Tuzatish tugadi — so'rovni o'chirib, kartani ASL joyida yangilaymiz.
      if (fixing.prompt_msg_id != null) {
        try {
          await ctx.deleteMessage(fixing.prompt_msg_id);
        } catch {
          /* ignore */
        }
      }
      await this.renderCardInPlace(
        ctx,
        p,
        fixing.idx,
        nonce,
        previews.length,
        fixing.card_msg_id,
      );
      ctx.session.fixing = undefined;
      ctx.session.step = 'ready';
      // Tuzatildi (kamchilik→tayyor) — jonli xulosani yangilaymiz.
      await this.updateSummary(ctx, marketId);
      return;
    }

    fixing.field = undefined;
    fixing.item_idx = undefined;

    if (!p.customer_name) {
      fixing.field = 'name';
      await this.replyFix(ctx, '🙍 Mijoz ismini yozing:', nonce);
      return;
    }
    if (!p.phone_number) {
      fixing.field = 'phone';
      await this.replyFix(
        ctx,
        '📞 Telefon raqamini yozing (masalan +998901234567):',
        nonce,
      );
      return;
    }
    if (!p.district_id) {
      // Geo tuzatish: VILOYAT topilmasa — viloyat ro'yxatidan tanlash; viloyat
      // bor lekin TUMAN yo'q — o'sha viloyat tumanlaridan tanlash. Matn yozsa ham
      // bo'ladi (resolveDistrictInput). field='district' — yozish shu orqali.
      fixing.field = 'district';
      const geo = await this.aiOrderService.getGeo();
      if (!p.region_id) {
        // Viloyat aniqlanmagan — barcha viloyatlarni tugma qilib ko'rsatamiz.
        fixing.region_list = geo.regions;
        const buttons = this.chunkButtons(
          geo.regions.map((r, i) => ({
            text: r.name,
            callback_data: `order_ai:fixregion:${nonce}:${i}`,
          })),
          2,
        );
        await this.replyFix(
          ctx,
          '📍 Viloyatni tanlang (yoki nomini yozing):',
          nonce,
          buttons,
        );
        return;
      }
      // Viloyat bor — shu viloyat tumanlarini tanlashga undaymiz.
      const regionDistricts = geo.districts.filter(
        (d) => d.region_id === p.region_id,
      );
      p.district_candidates = regionDistricts.map((d) => ({
        id: d.id,
        label: d.name,
        district_name: d.name,
        region_name: p.region_name,
      }));
      const buttons = this.chunkButtons(
        p.district_candidates.map((c, i) => ({
          text: c.label,
          callback_data: `order_ai:fixdistrict:${nonce}:${i}`,
        })),
        2,
      );
      await this.replyFix(
        ctx,
        `📍 «${p.region_name}» — tuman/shaharni tanlang (yoki nomini yozing):`,
        nonce,
        buttons,
      );
      return;
    }
    if (!p.is_replacement && p.total_price == null) {
      fixing.field = 'price';
      await this.replyFix(ctx, '💰 Narxni yozing (masalan 550000):', nonce);
      return;
    }
    if (
      !p.is_replacement &&
      p.total_price != null &&
      p.total_price < PRICE_CONFIRM_THRESHOLD &&
      !p.price_confirmed
    ) {
      fixing.field = 'price';
      await this.replyFix(
        ctx,
        `💰 Narx ${this.formatSom(p.total_price)} so'm — juda kichik ("1 mln"ni 1000 deb o'qigan bo'lishi mumkin).\n` +
          "To'g'ri narxni yozing. Bu narx ATAYLAB shunday bo'lsa (bepul/aksiya) — qayta yozib tasdiqlang (0 ham mumkin):",
        nonce,
      );
      return;
    }
    // Mahsulot: buyurtma bo'sh bo'lsa vaqtinchalik joy-egallovchi qo'shamiz —
    // shunda pastdagi "bad item" mantig'i ro'yxatni ko'rsatadi (bo'sh buyurtma
    // bo'lmaydi; mahsulot tanlanadi yoki o'chiriladi).
    if (!p.items.length) {
      p.items.push({ name: '(mahsulot)', quantity: 1 });
    }
    const badIdx = p.items.findIndex((it) => !it.product_id);
    if (badIdx >= 0) {
      const it = p.items[badIdx];
      fixing.field = 'item';
      fixing.item_idx = badIdx;
      // Nomzod bo'lsa — o'shalar; bo'lmasa — marketning TO'LIQ ro'yxati.
      // Bu cheksiz "yozing → xato" tsiklidan chiqish yo'li: foydalanuvchi
      // ro'yxatdan tanlaydi yoki mahsulotni o'chiradi.
      if (!it.candidates?.length) {
        const all = await this.aiOrderService.listProductsForMarket(marketId);
        it.candidates = all.slice(0, 30); // Telegram tugma cheki
      }
      const buttons = (it.candidates || []).map((c, i) => [
        {
          text: c.name,
          callback_data: `order_ai:fixproduct:${nonce}:${i}`,
        },
      ]);
      buttons.push([
        {
          text: '🚫 Bu mahsulotni o\'chirish',
          callback_data: `order_ai:fixdrop:${nonce}`,
        },
      ]);
      const label = it.candidates?.length
        ? `🛒 «${it.name}» topilmadi. Ro'yxatdan tanlang yoki to'g'ri nomini yozing:`
        : `🛒 Bu market mahsulotsiz. Nomini yozing yoki o'chiring:`;
      await this.replyFix(ctx, label, nonce, buttons);
      return;
    }
  }

  // Foydalanuvchi tuzatish rejimida yozgan matnni tegishli maydonga qo'llaydi.
  private async applyFix(
    ctx: MyContext,
    text: string,
    operator: { marketId: string },
  ) {
    const fixing = ctx.session.fixing;
    if (!fixing) {
      ctx.session.step = 'ready';
      return;
    }
    // Partiya eskirgan bo'lsa (yangi tahlil qilingan) — to'xtatamiz.
    if (fixing.nonce !== ctx.session.previews_nonce) {
      ctx.session.fixing = undefined;
      ctx.session.step = 'ready';
      await ctx.reply("⏳ Bu ro'yxat eskirgan — matnni qayta yuboring.");
      return;
    }
    const p = ctx.session.order_previews?.[fixing.idx];
    if (!p) {
      ctx.session.fixing = undefined;
      ctx.session.step = 'ready';
      return;
    }
    // Foydalanuvchi yozgan tuzatish matnini o'chiramiz (chat toza qolsin) —
    // matn allaqachon `text` parametrida.
    try {
      await ctx.deleteMessage();
    } catch {
      /* ignore */
    }
    const val = text.trim();

    // Noto'g'ri kiritishda: alohida "❌" xabar YUBORMAYMIZ (spam) — error_note
    // ni o'rnatib break qilamiz; promptNextFix o'sha maydonni izoh bilan qayta
    // so'raydi (eski so'rovни o'chirib). Cheksiz xato-tsikli yo'q.
    switch (fixing.field) {
      case 'name':
        p.customer_name = val;
        break;
      case 'phone': {
        const norm = this.aiOrderService.normalizePhoneInput(val);
        if (!norm) {
          fixing.error_note = "❌ Noto'g'ri raqam (+998 va 9 raqam).";
          break;
        }
        p.phone_number = norm;
        break;
      }
      case 'price': {
        const num = this.parsePriceInput(val);
        // 0 ruxsat (bepul); faqat manfiy/noson rad etiladi.
        if (num == null || num < 0) {
          fixing.error_note = "❌ Noto'g'ri narx (faqat son, 0 ham mumkin).";
          break;
        }
        p.total_price = num;
        // Operator narxni ATAYLAB kiritdi — kichik/0 bo'lsa ham TASDIQLANGAN.
        p.price_confirmed = true;
        break;
      }
      case 'district': {
        const r = await this.aiOrderService.resolveDistrictInput(val);
        // Hech narsa topilmasa — xato; promptNextFix viloyat ro'yxatini ko'rsatadi.
        if (!r.district_id && !r.region_id && !r.district_candidates?.length) {
          fixing.error_note = `❌ «${val}» topilmadi.`;
          break;
        }
        // Viloyat topilsa — o'rnatamiz (tuman yo'q bo'lsa promptNextFix tuman
        // ro'yxatini ko'rsatadi). Tuman topilsa — o'rnatamiz.
        if (r.region_id) {
          p.region_id = r.region_id;
          p.region_name = r.region_name;
          p.region_given = true;
        }
        if (r.district_id) {
          p.district_id = r.district_id;
          p.district_name = r.district_name;
        }
        p.district_candidates = r.district_candidates;
        break;
      }
      case 'item': {
        const idx = fixing.item_idx ?? -1;
        const qty = idx >= 0 && p.items[idx] ? p.items[idx].quantity : 1;
        const resolved = await this.aiOrderService.resolveItemInput(
          val,
          qty,
          operator.marketId,
        );
        if (!resolved.product_id && !resolved.candidates?.length) {
          // Topilmadi — item o'zgarmaydi; promptNextFix TO'LIQ ro'yxatni ko'rsatadi.
          fixing.error_note = `❌ «${val}» katalogda topilmadi.`;
          break;
        }
        if (idx >= 0 && p.items[idx]) p.items[idx] = resolved;
        else p.items.push(resolved);
        break;
      }
      default:
        break;
    }

    await this.promptNextFix(ctx, operator.marketId);
  }

  // createConfirmedOrders natija sababini foydalanuvchi uchun matnga aylantiradi.
  private createReasonText(reason?: string): string {
    switch (reason) {
      case 'insufficient':
        return "💳 AI balans yetarli emas — to'lov qilib qayta urinib ko'ring.";
      case 'duplicate':
        return '♻️ Bu buyurtma yaqinda allaqachon yaratilgan (dublikat).';
      case 'invalid_price':
        return "❌ Narx noto'g'ri — tuzating.";
      case 'disabled':
        return '🤖 Bu market uchun AI yoqilmagan.';
      case 'no_market':
        return '❌ Market aniqlanmadi.';
      default:
        return `❌ Yaratib bo'lmadi${reason ? `: ${reason}` : ''}.`;
    }
  }

  // "💳 AI balans: X so'm" qo'shimchasi (undefined bo'lsa — ozod, ko'rsatilmaydi)
  private aiBalanceSuffix(ctx: MyContext): string {
    const b = ctx.session.ai_balance_display;
    if (b == null) return '';
    return `\n\n💳 AI balans: ${this.formatSom(b)} so'm`;
  }

  private formatSom(n: number): string {
    return (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  @Command('balance')
  async onBalance(@Ctx() ctx: MyContext) {
    if (ctx.chat?.type !== 'private') return;
    const operator = await this.aiOrderService.resolveOperator(ctx.from?.id);
    if (!operator) {
      await ctx.reply("Avval botda ro'yxatdan o'ting.");
      return;
    }
    if (this.aiBalanceService.isExemptRole(operator.user.role)) {
      await ctx.reply("Sizda AI limiti yo'q (ichki xodim).");
      return;
    }
    const state = await this.aiBalanceService.getState(operator.marketId);
    if (!state) {
      await ctx.reply('Balans topilmadi.');
      return;
    }
    await ctx.reply(
      `💳 AI balans: ${this.formatSom(state.balance)} so'm\n` +
        `📦 Bir buyurtma narxi: ${this.formatSom(state.price)} so'm\n` +
        `⚡ AI holati: ${state.enabled ? 'yoqilgan ✅' : "o'chirilgan ❌"}`,
    );
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
    await ctx.reply(msg + this.aiBalanceSuffix(ctx), {
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

    // ── Ko'p-buyurtma "✅ Yaratish": bu partiya previews_nonce bilan ishlaydi
    // (order_draft.nonce EMAS), shuning uchun draft tekshiruvidan OLDIN turadi.
    if (action === 'mkcreate') {
      if (ctx.session.previews_nonce !== nonce) {
        await ctx.answerCbQuery(
          "⏳ Bu ro'yxat eskirgan — matnni qayta yuboring.",
          { show_alert: true },
        );
        return;
      }
      const previews = ctx.session.order_previews || [];
      const idx = Number(a3);
      const p = previews[idx];
      if (!p) {
        await ctx.answerCbQuery('⏳ Bu buyurtma topilmadi.', {
          show_alert: true,
        });
        return;
      }
      if (!p.ready) {
        // Yaratilgan yoki hali tayyor emas — qayta bosishni bloklaymiz.
        await ctx.answerCbQuery(
          '❌ Bu buyurtma tayyor emas yoki allaqachon yaratilgan.',
          { show_alert: true },
        );
        return;
      }
      const operator = await this.aiOrderService.resolveOperator(ctx.from?.id);
      if (!operator) {
        await ctx.answerCbQuery("Ruxsat yo'q.", { show_alert: true });
        return;
      }
      // Ikki marta bosishga qarshi: yaratishdan OLDIN ready'ni o'chiramiz
      // (parallel bosishlar takror yaratmasin). Muvaffaqiyatsiz bo'lsa tiklaymiz.
      p.ready = false;
      let result: {
        ok: boolean;
        reason?: string;
        order_number?: number;
        balance?: number;
        pending_approval?: boolean;
      };
      try {
        const confirmed = this.aiOrderService.previewToConfirmed(p);
        // Manba = 'bot' → guruh-tasdiqlash (CREATED→guruhga ✅/❌→NEW).
        const created = await this.aiOrderService.createConfirmedOrders(
          [confirmed],
          operator.jwt,
          operator.marketId,
          'bot',
        );
        result = created.results[0] || { ok: false, reason: 'create_failed' };
      } catch (e) {
        result = { ok: false, reason: getErrorMessage(e) };
      }

      if (result.ok) {
        p.created = true; // jonli xulosa hisobiga kiradi (tayyor→yaratilgan)
        const balSuffix =
          result.balance != null
            ? `\n💳 AI balans: ${this.formatSom(result.balance)} so'm`
            : '';
        const approvalNote = result.pending_approval
          ? '\n📨 Guruhga tasdiqlash uchun yuborildi.'
          : '';
        try {
          await ctx.editMessageText(
            `✅ Buyurtma #${result.order_number} yaratildi` +
              (p.customer_name ? ` — ${p.customer_name}` : '') +
              approvalNote +
              balSuffix,
          );
        } catch {
          /* ignore edit errors */
        }
        await ctx.answerCbQuery(
          result.pending_approval ? '📨 Guruhga yuborildi' : '✅ Yaratildi',
        );
        // Yuqoridagi jonli xulosani yangilaymiz (yaratilgan/tayyor/kamchilik/balans).
        await this.updateSummary(ctx, operator.marketId);
      } else {
        // Qayta urinishga ruxsat berish uchun ready'ni tiklaymiz (tugma qoladi).
        p.ready = true;
        await ctx.answerCbQuery(this.createReasonText(result.reason), {
          show_alert: true,
        });
      }
      return;
    }

    // ── Bot ichida tuzatish: "✏️ Tuzatish" bosilganda maydon-ma-maydon so'raladi.
    if (action === 'mkfix') {
      if (ctx.session.previews_nonce !== nonce) {
        await ctx.answerCbQuery(
          "⏳ Bu ro'yxat eskirgan — matnni qayta yuboring.",
          {
            show_alert: true,
          },
        );
        return;
      }
      const idx = Number(a3);
      const p = ctx.session.order_previews?.[idx];
      if (!p) {
        await ctx.answerCbQuery('⏳ Bu buyurtma topilmadi.', {
          show_alert: true,
        });
        return;
      }
      // Bir vaqtda faqat BITTA buyurtma tuzatiladi — boshqasi tuzatilayotgan
      // bo'lsa avval uni tugatish/bekor qilish kerak (aks holda eskisi unutilib,
      // prompt tugmalari chalkashardi).
      if (
        ctx.session.step === 'fixing' &&
        ctx.session.fixing &&
        ctx.session.fixing.idx !== idx
      ) {
        await ctx.answerCbQuery(
          '⚠️ Avval joriy tuzatishni tugating yoki "❌ Bekor" bosing.',
          { show_alert: true },
        );
        return;
      }
      const operator = await this.aiOrderService.resolveOperator(ctx.from?.id);
      if (!operator) {
        await ctx.answerCbQuery("Ruxsat yo'q.", { show_alert: true });
        return;
      }
      // Asl karta xabari id'si — tuzatish tugagach shu joyда yangilanadi (chat toza).
      const cb = ctx.callbackQuery as
        | { message?: { message_id?: number } }
        | undefined;
      ctx.session.fixing = { nonce, idx, card_msg_id: cb?.message?.message_id };
      ctx.session.step = 'fixing';
      // Kartadan tugmani olib tashlaymiz (qayta bosilmasin).
      try {
        await ctx.editMessageReplyMarkup(undefined);
      } catch {
        /* ignore */
      }
      await ctx.answerCbQuery('✏️ Tuzatish rejimi');
      await this.promptNextFix(ctx, operator.marketId);
      return;
    }

    // Tuzatishda VILOYATni tanlash (topilmagan bo'lsa) — keyin tuman so'raladi
    if (action === 'fixregion') {
      const fixing = ctx.session.fixing;
      if (ctx.session.previews_nonce !== nonce || !fixing) {
        await ctx.answerCbQuery('⏳ Eskirgan.', { show_alert: true });
        return;
      }
      const p = ctx.session.order_previews?.[fixing.idx];
      const r = fixing.region_list?.[Number(a3)];
      if (p && r) {
        p.region_id = r.id;
        p.region_name = r.name;
        p.region_given = true;
        // Viloyat o'zgardi — eski tuman/nomzodlarni tozalaymiz.
        p.district_id = undefined;
        p.district_name = undefined;
        p.district_candidates = undefined;
      }
      fixing.region_list = undefined;
      const operator = await this.aiOrderService.resolveOperator(ctx.from?.id);
      await ctx.answerCbQuery('✅');
      if (operator) await this.promptNextFix(ctx, operator.marketId);
      return;
    }

    // Tuzatishda tuman/shahar nomzodini tanlash
    if (action === 'fixdistrict') {
      const fixing = ctx.session.fixing;
      if (ctx.session.previews_nonce !== nonce || !fixing) {
        await ctx.answerCbQuery('⏳ Eskirgan.', { show_alert: true });
        return;
      }
      const p = ctx.session.order_previews?.[fixing.idx];
      const c = p?.district_candidates?.[Number(a3)];
      if (p && c) {
        p.district_id = c.id;
        p.district_name = c.district_name || c.label;
        p.region_name = c.region_name || p.region_name;
        p.region_given = true;
        p.district_candidates = undefined;
      }
      // Bu prompt (nomzodlar) keyingi promptNextFix'da o'chiriladi (chat toza).
      const operator = await this.aiOrderService.resolveOperator(ctx.from?.id);
      await ctx.answerCbQuery('✅');
      if (operator) await this.promptNextFix(ctx, operator.marketId);
      return;
    }

    // Tuzatishda mahsulot nomzodini tanlash
    if (action === 'fixproduct') {
      const fixing = ctx.session.fixing;
      if (ctx.session.previews_nonce !== nonce || !fixing) {
        await ctx.answerCbQuery('⏳ Eskirgan.', { show_alert: true });
        return;
      }
      const p = ctx.session.order_previews?.[fixing.idx];
      const item =
        p && fixing.item_idx != null ? p.items[fixing.item_idx] : undefined;
      const c = item?.candidates?.[Number(a3)];
      if (item && c) {
        item.product_id = c.id;
        item.resolved_name = c.name;
        item.candidates = undefined;
      }
      const operator = await this.aiOrderService.resolveOperator(ctx.from?.id);
      await ctx.answerCbQuery('✅');
      if (operator) await this.promptNextFix(ctx, operator.marketId);
      return;
    }

    // Tuzatishда mahsulotni o'chirish (katalogda yo'q — o'rniga qo'ymay tashlash)
    if (action === 'fixdrop') {
      const fixing = ctx.session.fixing;
      if (ctx.session.previews_nonce !== nonce || !fixing) {
        await ctx.answerCbQuery('⏳ Eskirgan.', { show_alert: true });
        return;
      }
      const p = ctx.session.order_previews?.[fixing.idx];
      if (
        p &&
        fixing.item_idx != null &&
        fixing.item_idx >= 0 &&
        p.items[fixing.item_idx]
      ) {
        p.items.splice(fixing.item_idx, 1);
      }
      const operator = await this.aiOrderService.resolveOperator(ctx.from?.id);
      await ctx.answerCbQuery("🚫 O'chirildi");
      if (operator) await this.promptNextFix(ctx, operator.marketId);
      return;
    }

    // Tuzatishni bekor qilish — so'rovni o'chirib, kartaga qaytadi (o'zgarishlar
    // qoladi; yaratilmaydi).
    if (action === 'fixcancel') {
      const fixing = ctx.session.fixing;
      ctx.session.fixing = undefined;
      ctx.session.step = 'ready';
      await ctx.answerCbQuery('❌ Bekor qilindi');
      // Joriy so'rov (bu callback xabari) o'chiriladi.
      try {
        await ctx.deleteMessage();
      } catch {
        /* ignore */
      }
      // Asl kartani joriy holati bilan (card_msg_id) tiklaymiz.
      const p =
        fixing && ctx.session.previews_nonce === fixing.nonce
          ? ctx.session.order_previews?.[fixing.idx]
          : undefined;
      if (p && fixing) {
        this.aiOrderService.recomputePreview(p);
        await this.renderCardInPlace(
          ctx,
          p,
          fixing.idx,
          fixing.nonce,
          ctx.session.order_previews?.length || 1,
          fixing.card_msg_id,
        );
      }
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
      await ctx.editMessageText(view.text + this.aiBalanceSuffix(ctx), {
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
      } catch (e) {
        // Xatoni LOG qilamiz (avval jim yutilardi — tuzatish prompt'i chiqmasdan
        // qolgan bug shu yerdan ko'rinadi), keyin callback'ni yopamiz.
        console.error(
          '[order_ai callback error]',
          data,
          (e as Error)?.stack || e,
        );
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
