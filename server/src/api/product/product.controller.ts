import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { SelfGuard } from 'src/common/guards/self.guard';

const uploadDir = './uploads';

const storage = diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${unique}${extname(file.originalname)}`);
  },
});

@ApiTags('Products')
@ApiBearerAuth()
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @ApiOperation({ summary: 'Create product with image (multipart/form-data)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'Product image file' },
        name: { type: 'string', example: 'Pepsi' },
        market_id: { type: 'string', format: 'uuid', example: 'a79f9f6a-dc32-4fcb-a3c1-8dabc1c51e9b' },
        image_url: { type: 'string', example: '17123456789', nullable: true },
      },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 201, description: 'Product created' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.MARKET)
  @Post()
  @UseInterceptors(FileInterceptor('image', { storage }))
  @HttpCode(HttpStatus.CREATED)
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    createProductDto: CreateProductDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    try {
      const result = await this.productService.create(
        createProductDto,
        file,
        currentUser,
      );
      return result;
    } catch (error) {
      if (file) {
        const filePath = `${uploadDir}/${file.filename}`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'List all products' })
  @ApiResponse({ status: 200, description: 'Products list' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR)
  @Get()
  async findAll() {
    return this.productService.findAll();
  }

  @ApiOperation({ summary: 'Get products by market id' })
  @ApiParam({ name: 'marketId', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'Products for market' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR)
  @Get('market/:marketId')
  async findByMarketId(@Param('marketId') marketId: string) {
    return this.productService.findByMarketId(marketId);
  }

  @ApiOperation({ summary: 'Get my products (market role)' })
  @ApiResponse({ status: 200, description: 'Products for current market' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('/my-products')
  async myProducts(@CurrentUser() user: JwtPayload) {
    return this.productService.getMyProducts(user);
  }

  @ApiOperation({ summary: 'Get product by id' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product data' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.MARKET, Roles.REGISTRATOR)
  @Get(':id')
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.productService.findOne(user, id);
  }

  @ApiOperation({ summary: 'Update product (admin/registrator) with optional image' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'New product image (optional)' },
        name: { type: 'string', example: 'Pepsi Max 1L', nullable: true },
        image_url: { type: 'string', example: '17123456789', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', { storage }))
  async update(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    updateProductDto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      return await this.productService.update(
        id,
        currentUser,
        updateProductDto,
        file,
      );
    } catch (error) {
      if (file) {
        const filePath = `${uploadDir}/${file.filename}`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'Update own product (market) with optional image' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'New product image (optional)' },
        name: { type: 'string', nullable: true },
        image_url: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Own product updated' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', { storage }))
  async updateOwnProduct(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    updateProductDto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      return await this.productService.updateOwnProduct(
        id,
        currentUser,
        updateProductDto,
        file,
      );
    } catch (error) {
      if (file) {
        const filePath = `${uploadDir}/${file.filename}`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'Delete product by id' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.MARKET)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
