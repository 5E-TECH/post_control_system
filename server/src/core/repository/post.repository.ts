import { Repository } from 'typeorm';
import { PostEntity } from '../entity/post.entity';

export type PostRepository = Repository<PostEntity>;
