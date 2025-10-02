import { Repository } from 'typeorm';
import { TelegramEntity } from '../entity/telegram-market.entity';
// import { Teleg } from "../entity/region.entity";

export type TelegramRepository = Repository<TelegramEntity>;
