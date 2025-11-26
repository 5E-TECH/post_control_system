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

@Update()
export class OrderBotUpdate {
  constructor(@InjectBot('Shodiyors') private bot: Telegraf<Context>) {}
 @Start()
async start(@Ctx() ctx: Context) {
  await ctx.reply(
    `👋 Salom men Beepost buyurtma yaratuvchi botman! Sizda buyurtma yaratish huquqi borligini tasdiqlash uchun WebApp orqali davom eting.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'WebAppni ochish',
              web_app: { url: 'https://latanya-unusable-andera.ngrok-free.dev/bot' },
            },
          ],
        ],
      },
    },
  );
}
  @Hears('salom')
  async hearsSalom(@Ctx() ctx: Context) {
    await ctx.reply('Valeykum!');
  }
  @Hears(/^group_token-.*/i)
  async hearToken(@Ctx() ctx: Context) {
    await ctx.reply('Tokenni oldim');
  }
}
