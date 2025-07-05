import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from 'src/core/entity/post.entity';
import { PostRepository } from 'src/core/repository/post.repository';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { DataSource, In } from 'typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRepo: PostRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    private readonly dataSource: DataSource
  ) {}
  
  async create(createPostDto: CreatePostDto, orderIDs: string[]): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (!orderIDs.length) {
        throw new BadRequestException('orderIDs required');
      }
      const orders = await this.orderRepo.findBy({ id: In(orderIDs) }); // Bazadan mavjud bo'lgan orderlarni olib kelamiz;
      if (!orders.length) {
        throw new NotFoundException('Orders not found');
      }
      const total_price = orders.reduce((acc, o) => acc + o.total_price, 0); // Har bir orderning narxini hisoblaymiz
      const quantity = orders.length;
      const newPost = this.postRepo.create({
        courier_id: createPostDto.courier_id,
        post_total_price: total_price,
        order_quantity: quantity,
        qr_code_token: createPostDto.qr_code_token,
      });
      const savedPost = await queryRunner.manager.save(newPost); //newPostni tranzaksiya bilan saqlab olyapmiz
      for (const order of orders) {
        order.post_id = savedPost.id; // Har bir orderga qaysi postga tegishli ekanligini belgilab olyapmiz
        await queryRunner.manager.save(order); // Keyin buni saqlab olyapmiz
      }
      await queryRunner.commitTransaction();
      return successRes(savedPost, 201, 'Post created successfully');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

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

  async update(id: string, updatePostDto: UpdatePostDto, orderIDs: string[]): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const post = await this.postRepo.findOne({ where: { id } }); // Berilgan id bo'yicha post mavjudligini tekshiramiz
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      let total_price = post.post_total_price; // agar orderIds berilmasa, oldingi qiymatlarni saqlab turamiz
      let quantity = post.order_quantity;
      if (orderIDs.length) { // orderIds bo'sh bo'lmasa yangi orderlar bilan yangilaymiz
        const orders = await this.orderRepo.findBy({ id: In(orderIDs) }); // Bazadan kiritilgan ID lar bo'yicha orderlarni topamiz
        total_price = orders.reduce((acc, o) => acc + o.total_price, 0);
        quantity = orders.length;
        for (const order of orders) {
          order.post_id = id; // Har bir orderni shu postga bo'glash
          await queryRunner.manager.save(order);
        }
      }
      post.courier_id = updatePostDto.courier_id || post.courier_id;
      post.qr_code_token = updatePostDto.qr_code_token || post.qr_code_token;
      post.post_total_price = total_price;
      post.order_quantity = quantity;
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

  async remove(id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const post = await this.postRepo.findOne({ where: { id } });
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      const orders = await this.orderRepo.findBy({ post_id: id });
      for (const order of orders) {
        order.post_id = null;
        await queryRunner.manager.save(order);
      }
      await queryRunner.manager.remove(PostEntity, post);
      await queryRunner.commitTransaction();
      return successRes(null, 200, 'Post deleted');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }
}
