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
  Query,
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
// import config from 'src/config';

// ✅ Absolute path
const uploadDir = 'home/ubuntu/uploads';

// Multer storage
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
        image: { type: 'string', format: 'binary' },
        name: { type: 'string', example: 'Pepsi' },
        market_id: { type: 'string', format: 'uuid' },
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
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createProductDto: CreateProductDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    try {
      return await this.productService.create(
        createProductDto,
        file,
        currentUser,
      );
    } catch (error) {
      if (file) {
        const filePath = `${uploadDir}/${file.filename}`;
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'List all products' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR)
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('marketId') marketId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.productService.findAll(
      search,
      marketId,
      Number(page),
      Number(limit),
    );
  }

  @ApiOperation({ summary: 'Get products by market id' })
  @ApiParam({ name: 'marketId', description: 'Market ID' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.REGISTRATOR, Roles.MARKET)
  @Get('market/:marketId')
  async findByMarketId(@Param('marketId') marketId: string) {
    return this.productService.findByMarketId(marketId);
  }

  @ApiOperation({ summary: 'Get my products (market role)' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('/my-products')
  async myProducts(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.productService.getMyProducts(
      user,
      search,
      Number(page),
      Number(limit),
    );
  }

  @ApiOperation({ summary: 'Get product by id' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.MARKET, Roles.REGISTRATOR)
  @Get(':id')
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.productService.findOne(user, id);
  }

  @ApiOperation({ summary: 'Update product (admin/registrator)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Product ID' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', { storage }))
  async update(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
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
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'Update own product (market)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Product ID' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Patch('my/:id') // ✅ DIFFERENT ROUTE
  @UseInterceptors(FileInterceptor('image', { storage }))
  async updateOwnProduct(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
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
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'Delete product by id' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @AcceptRoles(Roles.SUPERADMIN, Roles.ADMIN, Roles.REGISTRATOR, Roles.MARKET)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
