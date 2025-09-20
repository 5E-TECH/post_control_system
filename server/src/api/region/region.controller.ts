import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RegionService } from './region.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@ApiTags('Regions')
@Controller('region')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @Get()
  getAll(){
    return this.regionService.findAll()
  }

  @Get(':id')
  getOne(@Param('id') id: string){
    return this.regionService.findOneById(id)
  }
}
