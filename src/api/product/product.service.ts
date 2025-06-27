import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductEntity } from 'src/core/entity/product.entity';
import { Repository } from 'typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import * as fs from 'fs';
import * as path from 'path';
import config from 'src/config';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  private buildImageUrl(filename: string): string {
    return `${config.HOST_URL}/uploads/${filename}`;
  }

  async create(createProductDto: CreateProductDto, file?: Express.Multer.File) {
    try {
      if (file) {
        createProductDto.image_url = file.filename;
      }

      const product = this.productRepo.create(createProductDto);
      await this.productRepo.save(product);

      if (product.image_url) {
        product.image_url = this.buildImageUrl(product.image_url);
      }

      return successRes(product, 201);
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
      return successRes(products);
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string) {
    try {
      const product = await this.productRepo.findOne({ where: { id } });
      if (!product)
        throw new NotFoundException(`Product not found by id: ${id}`);

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
    updateProductDto: UpdateProductDto,
    file?: Express.Multer.File,
  ) {
    try {
      const product = await this.productRepo.findOne({ where: { id } });
      if (!product)
        throw new NotFoundException(`Product not found by id: ${id}`);

      if (file) {
        const oldPath = path.join(
          __dirname,
          '..',
          '..',
          'uploads',
          product.image_url,
        );
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        updateProductDto.image_url = file.filename;
      }

      const updated = this.productRepo.merge(product, updateProductDto);
      await this.productRepo.save(updated);

      if (updated.image_url) {
        updated.image_url = this.buildImageUrl(updated.image_url);
      }

      return successRes(updated);
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