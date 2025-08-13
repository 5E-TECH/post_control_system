import { Repository } from 'typeorm';
import { OrderItemEntity } from '../entity/order-item.entity';

export type OrderItemRepository = Repository<OrderItemEntity>;
