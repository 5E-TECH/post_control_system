import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductEntity } from 'src/core/entity/product.entity';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import * as fs from 'fs';
import * as path from 'path';
import config from 'src/config';
import { ProductRepository } from 'src/core/repository/product.repository';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Order_status, Roles } from 'src/common/enums';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderRepository } from 'src/core/repository/order.repository';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';
import { BotService } from '../bots/notify-bot/bot.service';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { TelegramRepository } from 'src/core/repository/telegram-market.repository';
import { getSafeLimit } from 'src/common/constants/pagination';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: ProductRepository,

    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,

    @InjectRepository(TelegramEntity)
    private readonly telegramRepo: TelegramRepository,

    private readonly botService: BotService,
  ) {}

  private buildImageUrl(filename: string): string {
    return `${config.HOST_URL}/uploads/${filename}`;
  }

  private normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  async create(
    createProductDto: CreateProductDto,
    file?: Express.Multer.File,
    currentUser?: JwtPayload,
  ) {
    try {
      const normalizedName = this.normalizeName(createProductDto.name);
      createProductDto.name = normalizedName;

      if (currentUser?.role === Roles.MARKET) {
        createProductDto.market_id = currentUser?.id;
      }
      const { name, market_id } = createProductDto;
      if (!market_id) {
        throw new BadRequestException('Market ID is required');
      }

      const isExistMarket = await this.userRepo.findOne({
        where: { id: market_id, role: Roles.MARKET },
      });
      if (!isExistMarket) {
        throw new NotFoundException('Market not found');
      }

      if (
        currentUser?.role === Roles.MARKET &&
        isExistMarket.add_order === false
      ) {
        throw new BadRequestException('You can not create order and product!');
      }

      const exists = await this.productRepo.findOne({
        where: {
          name,
          user_id: market_id,
          isDeleted: false,
        },
      });

      if (exists) {
        throw new ConflictException('Product name already exists');
      }

      const telegramGroup = await this.telegramRepo.findOne({
        where: { market_id },
      });

      let imageFileName: string | null = null;
      if (file) {
        imageFileName = file.filename;
      }

      const product = this.productRepo.create({
        name,
        user_id: market_id,
        image_url: imageFileName,
      });
      await this.productRepo.save(product);

      // 🔧 Save qilinganidan keyin pathni qayta yozamiz
      if (product.image_url) {
        product.image_url = this.buildImageUrl(product.image_url);
      }

      await this.botService.sendMessageToGroup(
        telegramGroup?.group_id ?? null,
        `🆕 New product added: <b>${product.name}</b>`,
      );

      return successRes(product, 201, 'New product added');
    } catch (error) {
      return catchError(error);
    }
  }

  async findAll(search?: string, marketId?: string, page = 1, limit?: number, fetchAll = false) {
    try {
      const safeLimit = getSafeLimit(limit, fetchAll);

      const query = this.productRepo
        .createQueryBuilder('product')
        .where('product.isDeleted = :is_deleted', { is_deleted: false })
        .leftJoinAndSelect('product.user', 'user')
        .orderBy('product.created_at', 'ASC')
        .skip((page - 1) * safeLimit)
        .take(safeLimit);

      // 🔍 search by product name
      if (search) {
        query.andWhere('product.name ILIKE :search', {
          search: `%${search}%`,
        });
      }

      // 🏪 filter by market_id (user_id)
      if (marketId) {
        query.andWhere('product.user_id = :marketId', { marketId });
      }

      const [products, total] = await query.getManyAndCount();

      // rasm url ni build qilish
      products.forEach((product) => {
        if (product.image_url) {
          product.image_url = this.buildImageUrl(product.image_url);
        }
      });

      return successRes(
        {
          items: products,
          total,
          page,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit),
        },
        200,
        'All products',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async findByMarketId(marketId: string) {
    try {
      const market = await this.userRepo.findOne({
        where: { id: marketId, role: Roles.MARKET },
      });
      if (!market) {
        throw new NotFoundException('Market not found');
      }

      const products = await this.productRepo.find({
        where: { user_id: marketId, isDeleted: false },
        relations: ['user'],
        order: { created_at: 'ASC' },
      });
      products.forEach((product) => {
        if (product.image_url) {
          product.image_url = this.buildImageUrl(product.image_url);
        }
      });
      return successRes({ products }, 200, `All products of ${market.name}`);
    } catch (error) {
      return catchError(error);
    }
  }

  async getMyProducts(user: JwtPayload, search?: string, page = 1, limit?: number, fetchAll = false) {
    try {
      const safeLimit = getSafeLimit(limit, fetchAll);

      const currentUser = await this.userRepo.findOne({
        where: { id: user.id },
      });
      if (!currentUser) {
        throw new NotFoundException('User not found');
      }
      const userId =
        currentUser.role === Roles.MARKET
          ? currentUser.id
          : currentUser.market_id;
      const qb = this.productRepo
        .createQueryBuilder('product')
        .where('product.user_id = :userId', { userId })
        .andWhere('product.isDeleted = :is_deleted', { is_deleted: false });

      if (search) {
        qb.andWhere('(product.name ILIKE :search)', {
          search: `%${search}%`,
        });
      }

      qb.orderBy('product.created_at', 'DESC')
        .skip((page - 1) * safeLimit)
        .take(safeLimit);

      const [products, total] = await qb.getManyAndCount();

      products.forEach((product) => {
        if (product.image_url) {
          product.image_url = this.buildImageUrl(product.image_url);
        }
      });

      return successRes(
        {
          products,
          total,
          page,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit),
        },
        200,
        'All my products',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(user: JwtPayload, id: string) {
    try {
      const product = await this.productRepo.findOne({
        where: { id, isDeleted: false },
      });
      if (!product || product.user_id !== user.id) {
        throw new NotFoundException(`Product not found by id: ${id}`);
      }
      if (product.image_url) {
        product.image_url = this.buildImageUrl(product.image_url);
      }

      return successRes(product);
    } catch (error) {
      return catchError(error);
    }
  }

  async update(
    id: string,
    currentUser: JwtPayload,
    updateProductDto: UpdateProductDto,
    file?: Express.Multer.File,
  ) {
    try {
      const product = await this.productRepo.findOne({ where: { id } });
      if (!product) throw new NotFoundException('Product not found');

      // ✅ Name majburiy, normalize qilamiz
      if (!updateProductDto.name) {
        throw new BadRequestException('Product name is required');
      }
      updateProductDto.name = this.normalizeName(updateProductDto.name);

      const { name } = updateProductDto;

      // ✅ Boshqa mahsulotda bu name + market_id mavjudmi?
      const exists = await this.productRepo.findOne({
        where: { name, user_id: product.user_id },
      });

      if (exists) {
        throw new ConflictException(
          'Another product with same name and market already exists',
        );
      }

      if (file) {
        const filePath = path.join('uploads', file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      // ✅ Agar yangi fayl kelgan bo‘lsa — eski rasmni o‘chir
      if (file) {
        if (product.image_url) {
          const oldPath = path.join(
            process.cwd(),
            'uploads',
            product.image_url,
          );
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        updateProductDto.image_url = file.filename;
      }

      // ✅ Update qilamiz
      const updated = this.productRepo.merge(product, updateProductDto);
      await this.productRepo.save(updated);

      // ✅ To‘liq URL yasaymiz
      if (updated.image_url) {
        updated.image_url = this.buildImageUrl(updated.image_url);
      }

      return successRes(updated, 200, 'Product updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async updateOwnProduct(
    id: string,
    currentUser: JwtPayload,
    updateProductDto: UpdateProductDto,
    file?: Express.Multer.File,
  ) {
    try {
      const product = await this.productRepo.findOne({
        where: { id, user_id: currentUser.id },
      });
      if (!product) throw new NotFoundException('Product not found');

      // ✅ Name majburiy, normalize qilamiz
      if (!updateProductDto.name) {
        throw new BadRequestException('Product name is required');
      }
      updateProductDto.name = this.normalizeName(updateProductDto.name);

      const { name } = updateProductDto;

      // ✅ Boshqa mahsulotda bu name + market_id mavjudmi?
      const exists = await this.productRepo.findOne({
        where: { name, user_id: currentUser.id },
      });

      if (exists) {
        throw new ConflictException(
          'Another product with same name and market already exists',
        );
      }

      // ✅ Agar yangi fayl kelgan bo‘lsa — eski rasmni o‘chir
      if (file) {
        if (product.image_url) {
          const oldPath = path.join(
            process.cwd(),
            'uploads',
            product.image_url,
          );
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        updateProductDto.image_url = file.filename;
      }

      // ✅ Update qilamiz
      const updated = this.productRepo.merge(product, updateProductDto);
      await this.productRepo.save(updated);

      // ✅ To‘liq URL yasaymiz
      if (updated.image_url) {
        updated.image_url = this.buildImageUrl(updated.image_url);
      }

      return successRes(updated, 200, 'Product updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async remove(id: string) {
    try {
      const product = await this.productRepo.findOne({
        where: { id, isDeleted: false },
      });
      if (!product) {
        throw new NotFoundException(`Product not found by id: ${id}`);
      }

      // 🟡 Faylni o‘chirish
      if (product.image_url) {
        const imagePath = path.join(
          process.cwd(),
          'uploads',
          product.image_url,
        );
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (fileError) {
          console.warn(
            `Could not delete file: ${imagePath}`,
            fileError.message,
          );
        }
      }

      // 🟡 Soft delete qilish
      product.isDeleted = true;
      product.name = `${product.name + Date.now()}_deleted`;
      await this.productRepo.save(product);

      return successRes({}, 200, 'Product deleted');
    } catch (error) {
      return catchError(error);
    }
  }
}
