import { Repository } from 'typeorm';
import { CustomerMarketEntity } from '../entity/customer-market.entity';

export type CustomerMarketReository = Repository<CustomerMarketEntity>;
