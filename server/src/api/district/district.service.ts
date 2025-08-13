import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { RegionEntity } from 'src/core/entity/region.entity';
import { DistrictRepository } from 'src/core/repository/district.repository';
import { RegionRepository } from 'src/core/repository/region.repository';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { CreateDistrictDto } from './dto/create-district.dto';
import { DeepPartial } from 'typeorm';
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
            created_at: Date.now(),
            updated_at: Date.now(),
          });
        }
      }
    }
  }

  async create(createDistrictDto: CreateDistrictDto) {
    try {
      const { name, region_id } = createDistrictDto;
      const existsName = await this.districtRepository.findOneBy({ name });
      if (existsName) {
        throw new ConflictException('district alread exists');
      }
      const existsRegion = await this.regionRepository.findOneBy({
        id: region_id,
      });
      if (!existsRegion) {
        throw new NotFoundException('region not found');
      }
      const district = this.districtRepository.create({
        name,
        region_id,
      });
    } catch (error) {
      return catchError(error);
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
        relations: ['region'],
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
      const district = await this.districtRepository.findOne({ where: { id } });
      if (!district) {
        throw new NotFoundException('district nor found');
      }
      if (updateDistrictDto.name) {
        const existsName = await this.districtRepository.findOne({
          where: { name: updateDistrictDto.name },
        });
        if (existsName) {
          throw new ConflictException('district alread exists');
        } else if (updateDistrictDto.region_id) {
          const existsRegion = await this.regionRepository.findOne({
            where: { id: updateDistrictDto.region_id },
          });
          if (!existsRegion) {
            throw new NotFoundException('region not found');
          }
        }
      }
      await this.districtRepository.update({ id }, updateDistrictDto);
      const updateDistrict = await this.districtRepository.findOne({
        where: { id },
      });
      return successRes(updateDistrict);
    } catch (error) {
      return catchError(error);
    }
  }

  async remove(id: string) {
    try {
      const district = await this.districtRepository.findOne({ where: { id } });
      if (!district) {
        throw new NotFoundException('district nor found');
      }
      await this.districtRepository.delete({ id });
      return successRes({});
    } catch (error) {
      return catchError(error);
    }
  }
}
