import { Repository } from 'typeorm';
import { CashboxCardMovementEntity } from '../entity/cashbox-card-movement.entity';

export type CashboxCardMovementRepository =
  Repository<CashboxCardMovementEntity>;
