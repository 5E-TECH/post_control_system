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
import { In } from 'typeorm';
import { UserEntity } from 'src/core/entity/users.entity';
import { UserRepository } from 'src/core/repository/user.repository';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: ProductRepository,

    @InjectRepository(UserEntity)
    private readonly userRepo: UserRepository,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: OrderRepository,
  ) {}

  private buildImageUrl(filename: string): string {
    return `${config.HOST_URL}${config.PORT}/uploads/${filename}`;
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
      const exists = await this.productRepo.findOne({
        where: {
          name,
          market_id,
        },
      });

      if (exists) {
        throw new ConflictException('Product name already exists');
      }

      if (file) {
        createProductDto.image_url = file.filename;
      }

      const product = this.productRepo.create(createProductDto);
      await this.productRepo.save(product);

      if (product.image_url) {
        product.image_url = this.buildImageUrl(product.image_url);
      }

      return successRes(product, 201, 'New product added');
    } catch (error) {
      return catchError(error);
    }
  }

  async findAll() {
    try {
      const products = await this.productRepo.find();
      products.forEach((product) => {
        if (product.image_url) {
          product.image_url = this.buildImageUrl(product.image_url);
        }
      });
      return successRes(products, 200, 'All products');
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
        where: { market_id: marketId },
      });
      products.forEach((product) => {
        if (product.image_url) {
          product.image_url = this.buildImageUrl(product.image_url);
        }
      });
      return successRes(products, 200, `All products of ${market.name}`);
    } catch (error) {
      return catchError(error);
    }
  }

  async getMyProducts(user: JwtPayload) {
    try {
      const products = await this.productRepo.find({
        where: { market_id: user.id },
      });
      products.forEach((product) => {
        if (product.image_url) {
          product.image_url = this.buildImageUrl(product.image_url);
        }
      });
      return successRes(products, 200, 'All my products');
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(user: JwtPayload, id: string) {
    try {
      const product = await this.productRepo.findOne({ where: { id } });
      if (!product || product.market_id !== user.id) {
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
        where: { name, market_id: product.market_id },
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
        where: { id, market_id: currentUser.id },
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
        where: { name, market_id: currentUser.id },
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
      const product = await this.productRepo.findOne({ where: { id } });
      if (!product)
        throw new NotFoundException(`Product not found by id: ${id}`);

      if (product.image_url) {
        const imagePath = path.join(
          process.cwd(),
          'uploads',
          product.image_url,
        );
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }

      await this.productRepo.delete({ id });
      return successRes({});
    } catch (error) {
      return catchError(error);
    }
  }
}
