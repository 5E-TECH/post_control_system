import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Body,
  Post,
  Delete,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DistrictService } from './district.service';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictNameDto } from './dto/update-name.dto';
import { UpdateDistrictSatoCodeDto } from './dto/update-sato-code.dto';
import { MergeDistrictsDto } from './dto/merge-districts.dto';

@ApiTags('Districts')
@Controller('district')
export class DistrictController {
  constructor(private readonly districtService: DistrictService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(
    Roles.ADMIN,
    Roles.SUPERADMIN,
    Roles.REGISTRATOR,
    Roles.MARKET,
    Roles.COURIER,
    Roles.OPERATOR,
  )
  @Get()
  getAll() {
    return this.districtService.findAll();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Post()
  create(@Body() createDistrictDto: CreateDistrictDto) {
    return this.districtService.create(createDistrictDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(
    Roles.ADMIN,
    Roles.SUPERADMIN,
    Roles.COURIER,
    Roles.MARKET,
    Roles.OPERATOR,
  )
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.districtService.findById(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.COURIER, Roles.MARKET)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDistrictDto: UpdateDistrictDto,
  ) {
    return this.districtService.update(id, updateDistrictDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Patch('name/:id')
  updateName(
    @Param('id') id: string,
    @Body() updateDto: UpdateDistrictNameDto,
  ) {
    return this.districtService.updateName(id, updateDto);
  }

  @Get('sato/:satoCode')
  getBySatoCode(@Param('satoCode') satoCode: string) {
    return this.districtService.findBySatoCode(satoCode);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Patch('sato/:id')
  updateSatoCode(
    @Param('id') id: string,
    @Body() dto: UpdateDistrictSatoCodeDto,
  ) {
    return this.districtService.updateSatoCode(id, dto);
  }

  /**
   * SATO kodlarini mavjud tumanlar bilan moslashtirish (preview)
   * Hech narsa o'zgarmaydi - faqat ko'rish uchun
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Get('sato-match/preview')
  matchSatoCodes() {
    return this.districtService.matchSatoCodes();
  }

  /**
   * Mos kelgan tumanlarga SATO kodlarini avtomatik qo'shish
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Post('sato-match/apply')
  applySatoCodes() {
    return this.districtService.applySatoCodes();
  }

  /**
   * Tumanlarni birlashtirish
   * Barcha buyurtmalar source tumanlardan target tumanga ko'chiriladi
   * Source tumanlar o'chiriladi
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Post('merge')
  mergeDistricts(@Body() dto: MergeDistrictsDto) {
    return this.districtService.mergeDistricts(dto);
  }

  /**
   * Tumanni o'chirish (faqat buyurtmasi bo'lmagan tumanlarni)
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Delete(':id')
  deleteDistrict(@Param('id') id: string) {
    return this.districtService.deleteDistrict(id);
  }

  /**
   * DEBUG: Tumandagi buyurtmalar sonini tekshirish
   */
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN)
  @Get('debug/orders/:id')
  debugDistrictOrders(@Param('id') id: string) {
    return this.districtService.debugDistrictOrders(id);
  }
}
