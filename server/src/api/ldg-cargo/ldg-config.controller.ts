import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Length, Matches, Min } from 'class-validator';
import { LdgConfigService } from './ldg-config.service';
import { UpdateLdgConfigDto } from './dto/ldg-config.dto';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';

class BindCourierDto {
  @IsUUID()
  user_id!: string;
}

class CreateLdgCourierDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'phone_number +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  phone_number!: string;

  @IsInt()
  @Min(0)
  tariff_home!: number;

  @IsInt()
  @Min(0)
  tariff_center!: number;

  @IsUUID()
  region_id?: string;
}

@ApiTags('LDG Cargo')
@ApiBearerAuth()
@Controller('ldg/config')
@UseGuards(JwtGuard, RolesGuard)
@AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN)
export class LdgConfigController {
  constructor(private readonly configService: LdgConfigService) {}

  @ApiOperation({
    summary: 'LDG sozlamalarini olish (sezgir maydonlar yashirilgan)',
  })
  @Get()
  async get() {
    return this.configService.getSafe();
  }

  @ApiOperation({ summary: 'LDG sozlamalarini yangilash' })
  @Patch()
  async update(@Body() dto: UpdateLdgConfigDto) {
    return this.configService.update(dto);
  }

  @ApiOperation({
    summary: 'Mavjud kuryerni LDG vakil-user qilib biriktirish',
  })
  @Post('bind-courier')
  async bindCourier(@Body() dto: BindCourierDto) {
    return this.configService.bindCourier(dto.user_id);
  }

  @ApiOperation({
    summary:
      'Yangi virtual kuryer-user yaratish va LDG vakil qilib belgilash',
  })
  @Post('create-courier')
  async createCourier(@Body() dto: CreateLdgCourierDto) {
    return this.configService.createCourier(dto);
  }
}
