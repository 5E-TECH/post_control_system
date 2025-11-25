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
    ctx.reply(
      `👋 Salom men Beepost buyurtma yaratuvchi botman! Sizda buyurtma yaratish huquqi borligini tasdiqlash uchun menga platformadagi telegram tokenni tashlang`,
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
