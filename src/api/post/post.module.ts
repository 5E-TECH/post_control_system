import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from 'src/core/entity/post.entity';
import { OrderEntity } from 'src/core/entity/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PostEntity, OrderEntity])],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
