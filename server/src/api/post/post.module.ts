import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from 'src/core/entity/post.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PostEntity, OrderEntity, UserEntity])],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
