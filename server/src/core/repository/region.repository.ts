import { Repository } from "typeorm";
import { RegionEntity } from "../entity/region.entity";

export type RegionRepository = Repository<RegionEntity>