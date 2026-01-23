import { Repository } from 'typeorm';
import { ShiftEntity } from '../entity/shift.entity';

export type ShiftRepository = Repository<ShiftEntity>;
