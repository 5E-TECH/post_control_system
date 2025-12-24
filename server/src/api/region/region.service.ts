import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { RegionEntity } from 'src/core/entity/region.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RegionRepository } from 'src/core/repository/region.repository';
import { successRes } from 'src/infrastructure/lib/response';
import { catchError } from 'rxjs';
import { regions } from 'src/infrastructure/lib/data/district';

@Injectable()
export class RegionService implements OnModuleInit {
  constructor(
    @InjectRepository(RegionEntity) private regionRepository: RegionRepository,
  ) {}

  async onModuleInit() {
    try {
      const existingRegions = await this.regionRepository.find();

      if (existingRegions.length === 0) {
        const regionList = regions.map((item) => ({ name: item.name }));
        const regionEntities = this.regionRepository.create(regionList);
        await this.regionRepository.save(regionEntities);
      }
    } catch (error) {
      console.error('❌ Viloyatlar yaratishda xatolik:', error);
    }
  }

  async findAll() {
    try {
      const regions = await this.regionRepository.find({
        relations: ['assignedDistricts'],
        order: { created_at: 'ASC' },
      });
      return successRes(regions, 200, 'All regions with assigned districts');
    } catch (error) {
      return catchError(error);
    }
  }

  async findOneById(id: string) {
    try {
      const region = await this.regionRepository.findOne({
        where: { id },
        relations: ['districts'],
      });
      if (!region) {
        throw new NotFoundException('Region topilmadi');
      }
      return successRes(region);
    } catch (error) {
      return catchError(error);
    }
  }
}
