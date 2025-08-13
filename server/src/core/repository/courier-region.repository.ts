import { Repository } from 'typeorm';
import { CourierRegionEntity } from '../entity/courier-region.entity';

export type CourierRegionReository = Repository<CourierRegionEntity>;
