import { Ctx, Hears, Help, On, Start, Update } from 'nestjs-telegraf';
import { Context, NarrowedContext } from 'telegraf';
import {
  Message,
  Update as TgUpdate,
} from 'telegraf/typings/core/types/typegram';
import { BotService } from './bot.service';

@Update()
export class BotUpdate {
  constructor(private readonly botService: BotService) {}
  @Start()
  async start(@Ctx() ctx: Context) {
    ctx.reply(
      `👋 Salom men Beepost botman. Ushbu guruhga xabar jo'natishim uchun platformadagi telegram tokenni shu yerga jo'nating`,
    );
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await ctx.reply('📌 Mavjud komandalar: /start, /help');
  }

  @Hears(/^group_token-.*/i)
  async addBotToGroup(
    @Ctx()
    ctx: NarrowedContext<Context, TgUpdate.MessageUpdate<Message.TextMessage>>,
  ) {
    const text = ctx.message['text'];
    const response = await this.botService.addToGroup(text, ctx);
    await ctx.reply('⌛ Malumot tahlil qilinyapti...');

    setTimeout(async () => {
      await ctx.deleteMessage();
      await ctx.reply(response.message);
    }, 2000);
  }

  @Hears('salom')
  async hearsSalom(@Ctx() ctx: Context) {
    await ctx.reply('Valeykum assalom!');
  }

  @Hears(/^yangi buyurtma.*/i)
  async createOrder(@Ctx() ctx: Context) {}
}
