import { Repository } from 'typeorm';
import { CashboxCardEntity } from '../entity/cashbox-card.entity';

export type CashboxCardRepository = Repository<CashboxCardEntity>;
