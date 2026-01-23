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
import { BotService } from './bot.service';
import config from 'src/config';

@Update()
export class BotUpdate {
  constructor(
    @InjectBot(config.BOT_NAME) private bot: Telegraf<Context>,
    private readonly botService: BotService,
  ) {}
  @Start()
  async start(@Ctx() ctx: Context) {
    try {
      await ctx.reply(
        `👋 Salom men Beepost botman. Ushbu guruhga xabar jo'natishim uchun platformadagi telegram tokenni shu yerga jo'nating`,
      );
    } catch (error) {
      console.log('Bot start error (user may have blocked the bot):', error.message);
    }
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    try {
      await ctx.reply('📌 Mavjud komandalar: /start, /help');
    } catch (error) {
      console.log('Bot help error:', error.message);
    }
  }

  @Hears(/^group_token-.*/i)
  async addBotToGroup(
    @Ctx()
    ctx: NarrowedContext<Context, TgUpdate.MessageUpdate<Message.TextMessage>>,
  ) {
    try {
      const text = ctx.message['text'];
      const response = await this.botService.addToGroup(text, ctx);
      await ctx.reply('⌛ Malumot tahlil qilinyapti...');

      setTimeout(async () => {
        try {
          await ctx.deleteMessage();
          await ctx.reply(response.message);
        } catch (error) {
          console.log('Bot addBotToGroup timeout error:', error.message);
        }
      }, 2000);
    } catch (error) {
      console.log('Bot addBotToGroup error:', error.message);
    }
  }

  @Hears('salom')
  async hearsSalom(@Ctx() ctx: Context) {
    try {
      await ctx.reply('Valeykum assalom!');
    } catch (error) {
      console.log('Bot salom error:', error.message);
    }
  }
}
