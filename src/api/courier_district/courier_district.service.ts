import { Injectable } from '@nestjs/common';
import { CreateCourierDistrictDto } from './dto/create-courier_district.dto';
import { UpdateCourierDistrictDto } from './dto/update-courier_district.dto';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { InjectRepository } from '@nestjs/typeorm';
import { CourierDistrict } from 'src/core/entity/courier_district.entity';
import { CourierDistrictRepository } from 'src/core/repository/courier_district.repository';
import { DeepPartial } from 'typeorm';

@Injectable()
export class CourierDistrictService extends BaseService<CreateCourierDistrictDto, DeepPartial<CourierDistrict>> {
  constructor(
    @InjectRepository(CourierDistrict) private readonly courierDistrictrepo:CourierDistrictRepository
  ) {
    super (courierDistrictrepo)
  }
  
}
