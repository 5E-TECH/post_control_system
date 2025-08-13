import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SendPostDto } from './dto/send-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from 'src/core/entity/post.entity';
import { PostRepository } from 'src/core/repository/post.repository';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { DataSource, In } from 'typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import { Order_status, Post_status, Roles } from 'src/common/enums';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRepo: PostRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<object> {
    try {
      const allPosts = await this.postRepo.find();
      return successRes(allPosts, 200, 'All posts');
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string): Promise<object> {
    try {
      const post = await this.postRepo.findOne({ where: { id } });
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      return successRes(post, 200, 'Post found');
    } catch (error) {
      return catchError(error);
    }
  }

  async findAllCouriers(id: string) {
    try {
      const post = await this.postRepo.findOne({ where: { id } });
      if (!post) {
        throw new NotFoundException();
      }
      const couriers = await this.userRepo.find({
        where: { region_id: post.region_id },
      });
      if (couriers.length === 0) {
        throw new NotFoundException(
          'There are not any couriers for this region',
        );
      }
      return successRes(couriers, 200, 'Couriers for this post');
    } catch (error) {
      return catchError(error);
    }
  }

  async sendPost(id: string, sendPostDto: SendPostDto): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const post = await this.postRepo.findOne({ where: { id } }); // Berilgan id bo'yicha post mavjudligini tekshiramiz
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      const { orderIds, courierId } = sendPostDto;
      const isExistCourier = await this.userRepo.findOne({
        where: { id, role: Roles.COURIER },
      });
      if (!isExistCourier) {
        throw new NotFoundException('Courier not found');
      }
      let total_price = post.post_total_price; // agar orderIds berilmasa, oldingi qiymatlarni saqlab turamiz
      let quantity = post.order_quantity;
      const orders = await this.orderRepo.findBy({ id: In(orderIds) });
      if (orderIds.length > 0 && orders.length !== quantity) {
        total_price = orders.reduce((acc, o) => acc + o.total_price, 0);
        quantity = orders.length;
      }
      if (orderIds.length === 0) {
        throw new BadRequestException('You can not send empty post');
      }
      for (const order of orders) {
        order.status = Order_status.ON_THE_ROAD; // Har bir orderni shu postga bo'glash
        await queryRunner.manager.save(order);
      }

      Object.assign(post, {
        courier_id: courierId,
        post_total_price: total_price,
        order_quantity: quantity,
        status: Post_status.SENT,
      });
      const updatedPost = await queryRunner.manager.save(post);

      await queryRunner.commitTransaction();
      return successRes(updatedPost, 200, 'Post updated');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // async remove(id: string) {
  //   const queryRunner = this.dataSource.createQueryRunner();
  //   await queryRunner.connect();
  //   await queryRunner.startTransaction();
  //   try {
  //     const post = await this.postRepo.findOne({ where: { id } });
  //     if (!post) {
  //       throw new NotFoundException('Post not found');
  //     }
  //     const orders = await this.orderRepo.findBy({ post_id: id });
  //     for (const order of orders) {
  //       order.post_id = null;
  //       await queryRunner.manager.save(order);
  //     }
  //     await queryRunner.manager.remove(PostEntity, post);
  //     await queryRunner.commitTransaction();
  //     return successRes(null, 200, 'Post deleted');
  //   } catch (error) {
  //     await queryRunner.rollbackTransaction();
  //     return catchError(error);
  //   } finally {
  //     await queryRunner.release();
  //   }
  // }
}
