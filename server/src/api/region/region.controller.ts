import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
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
@ApiBearerAuth()
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

  /**
   * Regionlar ro'yxati logist ma'lumoti bilan
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get('with-logist')
  getAllWithLogist() {
    return this.regionService.findAllWithLogist();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.regionService.findOneById(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
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
  @AcceptRoles(Roles.SUPERADMIN)
  @Get('sato-match/preview')
  matchSatoCodes() {
    return this.regionService.matchSatoCodes();
  }

  /**
   * Mos kelgan viloyatlarga SATO kodlarini avtomatik qo'shish
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Post('sato-match/apply')
  applySatoCodes() {
    return this.regionService.applySatoCodes();
  }

  /**
   * Viloyat nomini yangilash
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Patch('name/:id')
  updateName(@Param('id') id: string, @Body() dto: UpdateRegionNameDto) {
    return this.regionService.updateName(id, dto);
  }

  /**
   * Barcha viloyatlar statistikasi (xarita uchun)
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.LOGIST)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @Get('stats/all')
  getAllRegionsStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.regionService.getAllRegionsStats({ startDate, endDate });
  }

  /**
   * Bitta viloyat batafsil statistikasi
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.LOGIST)
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @Get('stats/:id')
  getRegionDetailedStats(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.regionService.getRegionDetailedStats(id, {
      startDate,
      endDate,
    });
  }

  // ==================== MAIN COURIER ASSIGNMENT ====================

  /**
   * Viloyatga asosiy kuryer biriktirish (yoki olib tashlash — courier_id: null)
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.LOGIST)
  @Patch('main-courier/:id')
  assignMainCourier(
    @Param('id') id: string,
    @Body() dto: { courier_id: string | null },
  ) {
    return this.regionService.assignMainCourier(id, dto.courier_id);
  }

  // ==================== LOGIST ASSIGNMENT ====================

  /**
   * Regionga logist biriktirish (yoki olib tashlash — logist_id: null)
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Patch('logist/:id')
  assignLogist(
    @Param('id') id: string,
    @Body() dto: { logist_id: string | null },
  ) {
    return this.regionService.assignLogist(id, dto.logist_id);
  }

  /**
   * Bir nechta regionga bitta logistni biriktirish (bulk)
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Post('logist/bulk-assign')
  bulkAssignLogist(@Body() dto: { logist_id: string; region_ids: string[] }) {
    return this.regionService.bulkAssignLogist(dto.logist_id, dto.region_ids);
  }
}
