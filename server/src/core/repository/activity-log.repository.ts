import { Repository } from 'typeorm';
import { ActivityLogEntity } from '../entity/activity-log.entity';

export type ActivityLogRepository = Repository<ActivityLogEntity>;
