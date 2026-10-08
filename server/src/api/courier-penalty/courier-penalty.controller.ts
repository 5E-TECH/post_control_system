import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { Roles } from 'src/common/enums';
import type { JwtPayload } from 'src/common/utils/types/user.type';
import { successRes } from 'src/infrastructure/lib/response';
import { CourierPenaltyService } from './courier-penalty.service';

/**
 * KURYER MUDDATLARI — o'z sanog'i.
 *
 * ⚠️ FAQAT O'ZINING ma'lumoti. Kuryer `id` ni parametr sifatida BERMAYDI —
 * u tokendan olinadi. Aks holda bir kuryer boshqasining shtraflarini
 * ko'rib tursa, bu shaxsiy moliyaviy ma'lumot oshkor bo'lardi.
 *
 * Adminlar uchun umumiy ro'yxat ALOHIDA endpoint bo'ladi (Faza 2) — shu
 * yerga `?courierId=` qo'shib qo'yish eng oson, lekin eng xavfli yo'l edi.
 */
@ApiTags('Kuryer shtraf moduli')
@Controller('courier-penalty')
export class CourierPenaltyController {
  constructor(
    private readonly service: CourierPenaltyService,
    private readonly dataSource: DataSource,
  ) {}

  @ApiOperation({
    summary: "Kuryerning o'z buyurtmalari muddati va mumkin bo'lgan shtraf",
    description:
      "Hal qilinmagan har buyurtma uchun: muddat qachon tugaydi, qancha vaqt qoldi, hozir bosilsa va ertaga bosilsa qancha shtraf. `module.active = false` bo'lsa SOYA rejimi — pul yechilmaydi.",
  })
  @ApiResponse({ status: 200, description: 'Muddat hisoboti' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Get('my-deadlines')
  async myDeadlines(@CurrentUser() user: JwtPayload) {
    const report = await this.service.myDeadlines(
      this.dataSource.manager,
      user.id,
    );
    return successRes(report, 200, 'Courier deadlines');
  }
}
