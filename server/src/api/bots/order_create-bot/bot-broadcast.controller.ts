import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { successRes } from 'src/infrastructure/lib/response';
import { BotNotifyService } from './bot-notify.service';
import { BroadcastDto } from './dto/broadcast.dto';

/**
 * ADMIN: bot orqali barcha ro'yxatdan o'tган foydalanuvchilarga e'lon yuborish
 * (masalan yangi AI funksiyasi haqida). Admin XOHLAGANDA bosadi — startup'да
 * avtomatik EMAS (restartда qayta yuborilmasin).
 */
@ApiTags('bot-broadcast')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
@Controller('bot-broadcast')
export class BotBroadcastController {
  constructor(private readonly botNotify: BotNotifyService) {}

  @Post()
  async send(@Body() dto: BroadcastDto) {
    const res = await this.botNotify.broadcast(dto.message);
    return successRes(
      res,
      200,
      `E'lon yuborildi: ${res.sent} ta / ${res.total} ta`,
    );
  }
}
