import { Repository } from "typeorm";
import { UserEntity } from "../entity/users.entity";

export type UserRepository = Repository<UserEntity>