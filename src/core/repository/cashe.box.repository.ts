import { Repository } from "typeorm";
import { CasheEntity } from "../entity/cashe-box.entity";

export type CasheRepository = Repository<CasheEntity>