import { Repository } from "typeorm";
import { CashEntity } from "../entity/cash-box.entity";

export type CashRepository = Repository<CashEntity>