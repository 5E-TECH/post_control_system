import { Repository } from "typeorm";
import { DistrictEntity } from "../entity/district.entity";

export type DistrictRepository = Repository<DistrictEntity>