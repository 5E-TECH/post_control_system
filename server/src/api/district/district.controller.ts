import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DistrictService } from './district.service';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';

@Controller('district')
export class DistrictController {
  constructor(private readonly districtService: DistrictService) {}

  @Post()
  create(@Body() createDistrictDto:CreateDistrictDto){
    return this.districtService.create(createDistrictDto)
  }

  @Get()
  getAll(){
    return this.districtService.findAll()
  }

  @Get(':id')
  getById(@Param('id') id:string){
    return this.districtService.findById(id)
  }

  @Patch(':id')
  update(@Param('id') id:string, updateDistrictDto:UpdateDistrictDto){
    return this.districtService.update(id, updateDistrictDto)
  }

  @Delete(':id')
  delete(@Param('id') id:string){
    return this.districtService.remove(id)
  }
}
