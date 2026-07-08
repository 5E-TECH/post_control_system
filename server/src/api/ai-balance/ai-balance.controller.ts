import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiBalanceService } from './ai-balance.service';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { successRes } from 'src/infrastructure/lib/response';
import { SetPriceDto, ToggleAiDto, TopupDto } from './dto/ai-balance.dto';

@ApiTags('ai-balance')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
@Controller('ai-balance')
export class AiBalanceController {
  constructor(private readonly aiBalance: AiBalanceService) {}

  // Market AI holati: yoqilganmi, balans, narx
  @Get(':marketId')
  async getState(@Param('marketId') marketId: string) {
    const state = await this.aiBalance.getState(marketId);
    return successRes(state, 200, 'OK');
  }

  // Balans tarixi (to'ldirish/ishlatish/refund)
  @Get(':marketId/history')
  async history(
    @Param('marketId') marketId: string,
    @Query('limit') limit?: string,
  ) {
    const rows = await this.aiBalance.getHistory(marketId, Number(limit) || 50);
    return successRes(rows, 200, 'OK');
  }

  // To'lov kelganda balansni to'ldirish
  @Post(':marketId/topup')
  async topup(
    @Param('marketId') marketId: string,
    @Body() dto: TopupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const res = await this.aiBalance.topup(
      marketId,
      dto.amount,
      user?.id,
      dto.note,
    );
    return successRes(res, 200, "Balans to'ldirildi");
  }

  // AI'ni market uchun yoqish/o'chirish
  @Patch(':marketId/toggle')
  async toggle(
    @Param('marketId') marketId: string,
    @Body() dto: ToggleAiDto,
  ) {
    await this.aiBalance.setEnabled(marketId, dto.enabled);
    return successRes(
      { enabled: dto.enabled },
      200,
      dto.enabled ? 'AI yoqildi' : "AI o'chirildi",
    );
  }

  // Market bo'yicha narxni belgilash (null = global default)
  @Patch(':marketId/price')
  async setPrice(@Param('marketId') marketId: string, @Body() dto: SetPriceDto) {
    await this.aiBalance.setPrice(marketId, dto.price);
    return successRes({ price: dto.price }, 200, 'Narx yangilandi');
  }
}
