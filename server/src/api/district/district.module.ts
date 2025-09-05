import { Module } from '@nestjs/common';
import { DistrictService } from './district.service';
import { DistrictController } from './district.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { RegionEntity } from 'src/core/entity/region.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DistrictEntity, RegionEntity])],
  controllers: [DistrictController],
  providers: [DistrictService],
})
export class DistrictModule {}
