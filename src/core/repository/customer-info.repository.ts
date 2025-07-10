import { Repository } from 'typeorm';
import { CustomerInfoEntity } from '../entity/customer-info.entity';

export type CustomerInfoRepository = Repository<CustomerInfoEntity>;
