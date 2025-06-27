import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateRegionDto } from './dto/create-region.dto';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { DeepPartial } from 'typeorm';
import { RegionEntity } from 'src/core/entity/region.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RegionRepository } from 'src/core/repository/region.repository';

@Injectable()
export class RegionService
  extends BaseService<CreateRegionDto, DeepPartial<RegionEntity>>
  implements OnModuleInit
{
  constructor(
    @InjectRepository(RegionEntity) private regionRepository: RegionRepository,
  ) {
    super(regionRepository);
  }

  async onModuleInit() {
  try {
    const existingRegions = await this.regionRepository.find();
    
    if (existingRegions.length === 0) {
      const regions = [
        { name: 'Toshkent' },
        { name: 'Andijon' },
        { name: 'Farg\'ona' },
        { name: 'Namangan' },
        { name: 'Samarqand' },
        { name: 'Buxoro' },
        { name: 'Xorazm' },
        { name: 'Qashqadaryo' },
        { name: 'Surxondaryo' },
        { name: 'Jizzax' },
        { name: 'Navoiy' },
        { name: 'Sirdaryo' },
      ];

      const regionEntities = this.regionRepository.create(regions);
      await this.regionRepository.save(regionEntities);
      console.log('✅ 12 ta viloyat yaratildi');
    } else {
      console.log('ℹ️ Viloyatlar allaqachon mavjud');
    }
  } catch (error) {
    console.error('❌ Viloyatlar yaratishda xatolik:', error);
  }
}
}
