import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BaseService } from 'src/infrastructure/lib/baseServise';
import { RegionEntity } from 'src/core/entity/region.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RegionRepository } from 'src/core/repository/region.repository';
import { successRes, catchError } from 'src/infrastructure/lib/response';
import { regions } from 'src/infrastructure/lib/data/district';
import { UpdateRegionSatoCodeDto } from './dto/update-sato-code.dto';
import { UpdateRegionNameDto } from './dto/update-region-name.dto';
import { Not } from 'typeorm';
import { matchRegions } from 'src/infrastructure/lib/utils/sato-matcher';

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

  async updateSatoCode(id: string, dto: UpdateRegionSatoCodeDto) {
    try {
      const region = await this.regionRepository.findOne({ where: { id } });
      if (!region) {
        throw new NotFoundException('Region topilmadi');
      }

      // SATO code unikalligi tekshirish
      const existingWithCode = await this.regionRepository.findOne({
        where: { sato_code: dto.sato_code, id: Not(id) },
      });
      if (existingWithCode) {
        throw new BadRequestException(
          `Bu SATO code allaqachon "${existingWithCode.name}" viloyatiga biriktirilgan`,
        );
      }

      region.sato_code = dto.sato_code;
      await this.regionRepository.save(region);

      return successRes(region, 200, 'Region SATO code yangilandi');
    } catch (error) {
      return catchError(error);
    }
  }

  async findBySatoCode(satoCode: string) {
    try {
      const region = await this.regionRepository.findOne({
        where: { sato_code: satoCode },
        relations: ['districts', 'assignedDistricts'],
      });
      if (!region) {
        throw new NotFoundException('Bu SATO code bilan viloyat topilmadi');
      }
      return successRes(region);
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * SATO kodlarini mavjud viloyatlar bilan moslashtirish (preview)
   */
  async matchSatoCodes() {
    try {
      const dbRegions = await this.regionRepository.find();
      const result = matchRegions(dbRegions);
      return successRes(result, 200, 'SATO matching natijasi');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Mos kelgan viloyatlarga SATO kodlarini avtomatik qo'shish
   */
  async applySatoCodes() {
    try {
      const dbRegions = await this.regionRepository.find();
      const matchResult = matchRegions(dbRegions);

      let appliedCount = 0;
      const applied: { id: string; name: string; sato_code: string }[] = [];

      for (const match of matchResult.matched) {
        // Faqat yangi kodlarni qo'shish (allaqachon mavjud bo'lmaganlarni)
        if (match.satoName !== '(allaqachon mavjud)') {
          await this.regionRepository.update(match.dbId, {
            sato_code: match.satoCode,
          });
          applied.push({
            id: match.dbId,
            name: match.dbName,
            sato_code: match.satoCode,
          });
          appliedCount++;
        }
      }

      return successRes(
        {
          applied,
          appliedCount,
          unmatched: matchResult.unmatched,
          duplicates: matchResult.duplicates,
          stats: matchResult.stats,
        },
        200,
        `${appliedCount} ta viloyatga SATO code qo'shildi`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Viloyat nomini yangilash
   */
  async updateName(id: string, dto: UpdateRegionNameDto) {
    try {
      const region = await this.regionRepository.findOne({ where: { id } });
      if (!region) {
        throw new NotFoundException('Region topilmadi');
      }

      region.name = dto.name;
      await this.regionRepository.save(region);

      return successRes(region, 200, 'Viloyat nomi yangilandi');
    } catch (error) {
      return catchError(error);
    }
  }
}
