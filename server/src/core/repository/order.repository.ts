import { Repository } from 'typeorm';
import { OrderEntity } from '../entity/order.entity';

export type OrderRepository = Repository<OrderEntity>;
