import {
  Ctx,
  Hears,
  Help,
  InjectBot,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
import { Context, NarrowedContext, Telegraf } from 'telegraf';
import {
  Message,
  Update as TgUpdate,
} from 'telegraf/typings/core/types/typegram';
import { OrderBotService } from './order-bot.service';
import { MyContext } from './session.interface';
import { Token } from 'src/infrastructure/lib/token-generator/token';

interface UserData extends Context {
  session: {
    marketData?: any;
    step?: string;
    phoneNumber?: string;
  };
}

@Update()
export class OrderBotUpdate {
  constructor(
    @InjectBot('Shodiyors') private bot: Telegraf<UserData>,
    private readonly orderBotService: OrderBotService,
  ) {}
  @Start()
  async start(@Ctx() ctx: Context) {
    if (ctx.chat?.type === 'private') {
      try {
        const response = await this.orderBotService.signInWithTelegram(ctx);
        console.log('Response', response);

        if (response.statusCode && `${response.statusCode}`.startsWith('2')) {
          ctx.reply(`👋 Salom siz buyurtma yaratishga tayyorsiz`, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 WebAppni ochish',
                    web_app: {
                      url: 'https://latanya-unusable-andera.ngrok-free.dev/bot',
                    },
                  },
                ],
              ],
            },
          });
        } else if (response.statusCode && `${response.statusCode}` === '404') {
          ctx.reply(
            `👋 Salom men Beepost buyurtma yaratuvchi botman! Sizda buyurtma yaratish huquqi borligini tasdiqlash uchun menga platformadagi telegram tokenni tashlang`,
          );
        } else {
          ctx.reply(response.message);
        }
      } catch (error) {
        ctx.reply(
          `${error.message}. Ro'yxatdan o'tishni boshlash uchun menga platformadagi telegram tokenni yuboring`,
        );
      }
    }
    if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
      ctx.reply(
        `👋 Salom men Beepost buyurtma yaratuvchi botman! Ushbu guruhga yaratilgan buyurtmalar haqida xabar jo'natishim uchun menga platformadagi telegram tokenni tashlang`,
      );
    }
  }

  @Hears('salom')
  async hearsSalom(@Ctx() ctx: Context) {
    await ctx.reply('Valeykum!');
  }

  @Hears(/^group_token-.*/i)
  async activateBot(
    @Ctx()
    ctx: NarrowedContext<
      MyContext,
      TgUpdate.MessageUpdate<Message.TextMessage>
    >,
  ) {
    const text = ctx.message['text'];
    if (ctx.chat?.type === 'private') {
      const response = await this.orderBotService.checkToken(text, ctx);
      await ctx.reply('⌛ Malumot tahlil qilinmoqda...');

      setTimeout(async () => {
        if (`${response.statusCode}`.startsWith('2') && response.data) {
          ctx.session.marketData = response.data;
          ctx.session.step = 'waiting_for_phone';
          ctx.session.waitingForPhone = true;
          ctx.session.userId = ctx.from.id;
          ctx.session.chatId = ctx.chat.id;
          ctx.session.name = ctx.from.first_name;

          await ctx.deleteMessage();
          await ctx.reply(
            "📞 Iltimos quyidagi raqamni ulashish tugmasi orqali menga raqamingizni jo'nating:",
            {
              reply_markup: this.orderBotService.shareContact(),
            },
          );
        } else {
          await ctx.reply(response.message);
        }
      }, 2000);
    }
    if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
      const response = await this.orderBotService.addToGroup(text, ctx);
      await ctx.reply('⌛ Malumot tahlil qilinmoqda...');

      setTimeout(async () => {
        await ctx.deleteMessage();
        await ctx.reply(response.message);
      }, 2000);
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
    if (!ctx.session.waitingForPhone || !ctx.session.marketData) {
      await ctx.reply('❌ Iltimos, avval tokenni yuboring.');
      return;
    }

    const contact = ctx.message.contact;
    const phone_number = contact.phone_number;

    if (contact.user_id !== ctx.from.id) {
      await ctx.reply(
        '❌ Iltimos, hozirda foydalanayotgan telegram telefon raqamingizni ulashing.',
        {
          reply_markup: this.orderBotService.shareContact(),
        },
      );
      return;
    }
  }
}
