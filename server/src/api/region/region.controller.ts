import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RegionService } from './region.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { UpdateRegionSatoCodeDto } from './dto/update-sato-code.dto';
import { UpdateRegionNameDto } from './dto/update-region-name.dto';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';

@ApiTags('Regions')
@Controller('region')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @Get()
  getAll() {
    return this.regionService.findAll();
  }

  @Get('sato/:satoCode')
  getBySatoCode(@Param('satoCode') satoCode: string) {
    return this.regionService.findBySatoCode(satoCode);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.regionService.findOneById(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Patch('sato/:id')
  updateSatoCode(
    @Param('id') id: string,
    @Body() dto: UpdateRegionSatoCodeDto,
  ) {
    return this.regionService.updateSatoCode(id, dto);
  }

  /**
   * SATO kodlarini mavjud viloyatlar bilan moslashtirish (preview)
   * Hech narsa o'zgarmaydi - faqat ko'rish uchun
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get('sato-match/preview')
  matchSatoCodes() {
    return this.regionService.matchSatoCodes();
  }

  /**
   * Mos kelgan viloyatlarga SATO kodlarini avtomatik qo'shish
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Post('sato-match/apply')
  applySatoCodes() {
    return this.regionService.applySatoCodes();
  }

  /**
   * Viloyat nomini yangilash
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Patch('name/:id')
  updateName(@Param('id') id: string, @Body() dto: UpdateRegionNameDto) {
    return this.regionService.updateName(id, dto);
  }
}
