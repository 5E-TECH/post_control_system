import { Repository } from 'typeorm';
import { CustomerEntity } from '../entity/customer.entity';

export type CustomerRepository = Repository<CustomerEntity>;
