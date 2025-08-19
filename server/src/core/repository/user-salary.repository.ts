import { Repository } from 'typeorm';
import { UserSalaryEntity } from '../entity/user-salary.entity';

export type UserSalaryRepository = Repository<UserSalaryEntity>;
