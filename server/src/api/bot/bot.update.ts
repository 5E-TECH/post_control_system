import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { BotService } from './bot.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { Ctx, Start, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Update()
@Controller('bot')
export class Botupdate {
  constructor(private readonly botService: BotService) {}

  @Start()
  onst(@Ctx() ctx: Context) {
    // ctx.reply(ctx.from?.id)
    return this.botService.findAll(ctx);
  }
}
