import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CourierDistrictService } from './courier_district.service';
import { CreateCourierDistrictDto } from './dto/create-courier_district.dto';
import { UpdateCourierDistrictDto } from './dto/update-courier_district.dto';

@Controller('courier-district')
export class CourierDistrictController {
  constructor(private readonly courierDistrictService: CourierDistrictService) {}

  @Post()
  create(@Body() createCourierDistrictDto: CreateCourierDistrictDto) {
    return this.courierDistrictService.create(createCourierDistrictDto);
  }

  @Get()
  findAll() {
    return this.courierDistrictService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.courierDistrictService.findOneById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCourierDistrictDto: UpdateCourierDistrictDto) {
    return this.courierDistrictService.update(id, updateCourierDistrictDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.courierDistrictService.delete(id);
  }
}
