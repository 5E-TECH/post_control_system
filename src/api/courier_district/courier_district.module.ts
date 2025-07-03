import { Module } from '@nestjs/common';
import { CourierDistrictService } from './courier_district.service';
import { CourierDistrictController } from './courier_district.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierDistrict } from 'src/core/entity/courier_district.entity';

@Module({
  imports:[TypeOrmModule.forFeature([CourierDistrict])],
  controllers: [CourierDistrictController],
  providers: [CourierDistrictService],
})
export class CourierDistrictModule {}
