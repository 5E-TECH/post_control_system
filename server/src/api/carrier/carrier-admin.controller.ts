import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Roles } from 'src/common/enums';
import { successRes } from 'src/infrastructure/lib/response';
import { CarrierAccountService } from './carrier-account.service';
import {
  CreateCarrierAccountDto,
  SetCarrierActiveDto,
  UpdateCarrierAccountDto,
} from './dto/carrier-admin.dto';

/**
 * CARRIER AKKAUNTLARI (admin) — tashqi yetkazuvchi kompaniyaga kuryer
 * akkaunti va `X-Api-Key` berish.
 *
 * Bu `/carrier/*` EMAS: bu yerga BeePost xodimlari JWT bilan kiradi
 * (SUPERADMIN va ADMIN — qaror Q8). Kontrakt va onboarding: `CARRIER_API.md`.
 *
 * ⚠️ `@AcceptRoles` HAR handlerda alohida — `RolesGuard` fail-closed va CI
 * `audit:roles` har handlerni tekshiradi; class darajasidagi dekorator
 * keyinroq qo'shilgan yangi handlerni jimgina ochib qo'ymasin.
 */
@ApiTags('Carrier accounts')
@ApiBearerAuth()
@Controller('carrier-accounts')
@UseGuards(JwtGuard, RolesGuard)
export class CarrierAdminController {
  constructor(private readonly accounts: CarrierAccountService) {}

  @Post()
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({
    summary:
      "Carrier akkaunt yaratish — kuryerga bog'lanadi, API kalit FAQAT shu javobda qaytadi",
  })
  async create(
    @Body() dto: CreateCarrierAccountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.accounts.create(dto, user);
    return successRes(
      result,
      201,
      "Carrier akkaunt yaratildi — kalitni hozir saqlang, u qayta ko'rsatilmaydi",
    );
  }

  @Get()
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({
    summary: "Carrier akkauntlar ro'yxati (kalitsiz, niqoblangan)",
  })
  async list() {
    return successRes(await this.accounts.list(), 200, 'Carrier akkauntlar');
  }

  @Patch(':id')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({
    summary:
      "Nom va IP ro'yxatini yangilash. Kuryer va kalit bu yerda o'zgarmaydi.",
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCarrierAccountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return successRes(
      await this.accounts.update(id, dto, user),
      200,
      'Carrier akkaunt yangilandi',
    );
  }

  @Post(':id/rotate-key')
  @HttpCode(200)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({
    summary:
      'API kalitni yangilash — eski kalit DARHOL ishlamaydi, yangisi faqat shu javobda',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async rotateKey(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return successRes(
      await this.accounts.rotateKey(id, user),
      200,
      'Kalit yangilandi — eski kalit bekor, yangisini hozir saqlang',
    );
  }

  @Post(':id/status')
  @HttpCode(200)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: "Carrier akkauntni yoqish/o'chirish (kill switch)" })
  @ApiParam({ name: 'id', format: 'uuid' })
  async setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCarrierActiveDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return successRes(
      await this.accounts.setActive(id, dto.is_active, user),
      200,
      dto.is_active ? 'Carrier akkaunt yoqildi' : "Carrier akkaunt o'chirildi",
    );
  }

  @Delete(':id')
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({
    summary:
      "Carrier akkauntni o'chirish (yumshoq) — kalit ishlamaydi, kuryer provayderdan bo'shatiladi",
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return successRes(
      await this.accounts.remove(id, user),
      200,
      "Carrier akkaunt o'chirildi",
    );
  }
}
