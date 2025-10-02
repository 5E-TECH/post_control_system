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
    const msg = this.botService.startBot(ctx);

    ctx.reply(`👋 ${msg}`);
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
    console.log(text, 'Kelgan xabar');
    const response = await this.botService.addToGroup(text, ctx);
    await ctx.reply(response.message);
  }

  @Hears('salom')
  async hearsSalom(@Ctx() ctx: Context) {
    await ctx.reply('Valeykum assalom!');
  }

  @On('text')
  async onMessage(
    ctx: NarrowedContext<Context, TgUpdate.MessageUpdate<Message.TextMessage>>,
  ) {
    console.log(ctx.message.text); // ✅ endi xato chiqmaydi
    await ctx.reply(`Siz yubordingiz: ${ctx.message.text}`);
  }
}
