import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DistrictEntity } from "src/core/entity/district.entity";
import { RegionEntity } from "src/core/entity/region.entity";
import { DistrictRepository } from "src/core/repository/district.repository";
import { RegionRepository } from "src/core/repository/region.repository";
import { BaseService } from "src/infrastructure/lib/baseServise";
import { CreateDistrictDto } from "./dto/create-district.dto";
import { DeepPartial } from "typeorm";

@Injectable()
export class DistrictService extends BaseService<CreateDistrictDto, DeepPartial<DistrictEntity>> implements OnModuleInit {
  constructor(
    @InjectRepository(DistrictEntity)
    private readonly districtRepository: DistrictRepository,

    @InjectRepository(RegionEntity)
    private readonly regionRepository: RegionRepository,
  ) {
    super (districtRepository)
    super (regionRepository)
  }

  async onModuleInit() {
    const count = await this.districtRepository.count();
    if (count > 0) return;

    const regionMap = await this.getRegionMap(); // viloyatlar nomidan ID olib beradi

    const districts = [
      { name: 'Yunusobod', regionName: 'Toshkent' },
      { name: 'Olmazor', regionName: 'Toshkent' },
      { name: 'Urganch', regionName: 'Xorazm' },
      { name: 'Bog\'ot', regionName: 'Xorazm' },
      { name: 'Qo\'qon', regionName: 'Farg\'ona' },
      { name: 'Marg\'ilon', regionName: 'Farg\'ona' },
      // davom ettirishingiz mumkin...
    ];

    const districtEntities = districts.map(d => ({
      name: d.name,
      region: regionMap[d.regionName],
    }));

    await this.districtRepository.save(districtEntities);
    console.log('✅ Tumanlar saqlandi');
  }

  private async getRegionMap(): Promise<Record<string, RegionEntity>> {
    const regions = await this.regionRepository.find();
    const map: Record<string, RegionEntity> = {};
    for (const region of regions) {
      map[region.name] = region;
    }
    return map;
  }
}
