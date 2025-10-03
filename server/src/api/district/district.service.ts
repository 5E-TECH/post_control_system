import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { RegionEntity } from 'src/core/entity/region.entity';
import { DistrictRepository } from 'src/core/repository/district.repository';
import { RegionRepository } from 'src/core/repository/region.repository';
import { successRes } from 'src/infrastructure/lib/response';
import { catchError } from 'rxjs';
import { regions } from 'src/infrastructure/lib/data/district';
import { UpdateDistrictDto } from './dto/update-district.dto';

@Injectable()
export class DistrictService implements OnModuleInit {
  constructor(
    @InjectRepository(DistrictEntity)
    private readonly districtRepository: DistrictRepository,

    @InjectRepository(RegionEntity)
    private readonly regionRepository: RegionRepository,
  ) {}

  async onModuleInit() {
    for (const region of regions) {
      const regionEntity = await this.regionRepository.findOne({
        where: { name: region.name },
      });

      if (!regionEntity) {
        continue;
      }

      for (const districtName of region.districts) {
        const exists = await this.districtRepository.findOne({
          where: { name: districtName, region: { id: regionEntity.id } },
        });

        if (!exists) {
          await this.districtRepository.save({
            name: districtName,
            region: regionEntity,
            assigned_region: regionEntity.id,
            created_at: Date.now(),
            updated_at: Date.now(),
          });
        }
      }
    }
  }

  async findAll() {
    try {
      const district = await this.districtRepository.find({
        relations: ['region'],
      });
      return successRes(district);
    } catch (error) {
      return catchError(error);
    }
  }

  async findById(id: string) {
    try {
      const district = await this.districtRepository.findOne({
        where: { id },
        relations: ['region', 'assignedToRegion'], // faqat obyektlarni qo‘shamiz
      });

      if (!district) {
        throw new NotFoundException('district not found');
      }

      return successRes(district);
    } catch (error) {
      return catchError(error);
    }
  }

  async update(id: string, updateDistrictDto: UpdateDistrictDto) {
    try {
      const { assigned_region } = updateDistrictDto;
      const district = await this.districtRepository.findOne({ where: { id } });
      if (!district) {
        throw new NotFoundException('District not found');
      }
      const assigningRegion = await this.regionRepository.findOne({
        where: { id: assigned_region },
      });
      if (!assigningRegion) {
        throw new NotFoundException(
          'The region you are trying to assign is not exist',
        );
      }
      if (district.assigned_region === assigningRegion.id) {
        throw new BadRequestException(
          'This district already assigned to this region',
        );
      }
      Object.assign(district, {
        assigned_region: assigningRegion.id,
      });
      await this.districtRepository.save(district);

      return successRes({}, 200, 'District assigned to new region');
    } catch (error) {
      return catchError(error);
    }
  }
}
