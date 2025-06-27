import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CreateRegionDto } from './dto/create-region.dto';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { DeepPartial } from 'typeorm';
import { RegionEntity } from 'src/core/entity/region.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RegionRepository } from 'src/core/repository/region.repository';
import { successRes } from 'src/infrastructure/lib/response';
import { catchError } from 'rxjs';

@Injectable()
export class RegionService implements OnModuleInit {
  constructor(
    @InjectRepository(RegionEntity) private regionRepository: RegionRepository,
  ) {}

  async onModuleInit() {
    try {
      const existingRegions = await this.regionRepository.find();

      if (existingRegions.length === 0) {
        const regions = [
          { name: 'Toshkent' },
          { name: 'Andijon' },
          { name: "Farg'ona" },
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

  async findAll() {
    try {
      const region = await this.regionRepository.find({
        relations: ['district'],
      });
      return successRes(region);
    } catch (error) {
      return catchError(error);
    }
  }

  async findOneById(id:string){
    try {
      const region = await this.regionRepository.findOne({where:{id}})
      if(!region){
        throw new NotFoundException("region not found")
      }
      return successRes(region)
    } catch (error) {
      return catchError(error)
    }
  }
}
