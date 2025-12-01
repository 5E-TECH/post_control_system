import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Body,
  Post,
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
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
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
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Patch('name/:id')
  updateName(
    @Param('id') id: string,
    @Body() updateDto: UpdateDistrictNameDto,
  ) {
    return this.districtService.updateName(id, updateDto);
  }
}
