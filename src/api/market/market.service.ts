import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MarketEntity } from 'src/core/entity/market.entity';
import { MarketRepository } from 'src/core/repository/market.repository';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { LoginMarketDto } from './dto/login-market.dto';
import { Roles } from 'src/common/enums';
import { writeToCookie } from 'src/infrastructure/lib/write-to-cookie/writeToCookie';
import { Response } from 'express';

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(MarketEntity) private marketRepo: MarketRepository,
    private readonly bcrypt: BcryptEncryption,
    private readonly token: Token,
  ) {}
  async createMarket(createMarketDto: CreateMarketDto) {
    try {
      const { market_name, phone_number, password } = createMarketDto;
      const existMarket = await this.marketRepo.findOne({
        where: { phone_number },
      });
      if (existMarket) {
        throw new ConflictException(
          'Market with this phone number already exist',
        );
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const newMarket = this.marketRepo.create({
        market_name,
        phone_number,
        password: hashedPassword,
      });
      await this.marketRepo.save(newMarket);
      return successRes(newMarket, 201);
    } catch (error) {
      return catchError(error);
    }
  }

  async findAll() {
    try {
      const allMarkets = await this.marketRepo.find({
        select: ['market_name', 'phone_number', 'status', 'created_at'],
      });
      return successRes(allMarkets, 200);
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string) {
    try {
      const market = await this.marketRepo.findOne({ where: { id } });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      return successRes(market, 200);
    } catch (error) {
      return catchError(error);
    }
  }

  async update(id: string, updateMarketDto: UpdateMarketDto) {
    try {
      const market = this.marketRepo.findOne({ where: { id } });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      const { password } = updateMarketDto;
      const hashedPassword = await this.bcrypt.encrypt(password);
    } catch (error) {}
  }

  async remove(id: string) {
    try {
      const market = await this.marketRepo.findOne({ where: { id } });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      await this.marketRepo.delete({ id });
      return successRes({}, 200);
    } catch (error) {
      return catchError(error);
    }
  }

  async marketLogin(
    loginMarketDto: LoginMarketDto,
    res: Response,
  ): Promise<Object> {
    try {
      const { login, password } = loginMarketDto;
      const isExisUser = await this.marketRepo.findOne({
        where: { phone_number: login },
      });
      if (!isExisUser) {
        throw new BadRequestException('Wrong login or password');
      }

      const isMatchedPassword = await this.bcrypt.compare(
        password,
        isExisUser.password,
      );

      if (!isMatchedPassword) {
        throw new BadRequestException('Wrong login or password');
      }
      const { id } = isExisUser;
      const payload = { id, role: Roles.MARKET };
      const accessTokenMarket = await this.token.generateAccessToken(payload);
      const refreshTokenMarket = await this.token.generateRefreshToken(payload);
      writeToCookie(res, 'refreshTokenmarket', refreshTokenMarket);
      return successRes(accessTokenMarket, 200);
    } catch (error) {
      return catchError(error);
    }
  }
}
