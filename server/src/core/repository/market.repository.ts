import { Repository } from 'typeorm';
import { MarketEntity } from '../entity/market.entity';

export type MarketRepository = Repository<MarketEntity>;
