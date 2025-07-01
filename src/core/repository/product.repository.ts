import { Repository } from 'typeorm';
import { ProductEntity } from '../entity/product.entity';

export type ProductRepository = Repository<ProductEntity>;
