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
import { Cashbox_type, Roles } from 'src/common/enums';
import { writeToCookie } from 'src/infrastructure/lib/write-to-cookie/writeToCookie';
import { Response } from 'express';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashRepository } from 'src/core/repository/cash.box.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(MarketEntity)
    private readonly marketRepo: MarketRepository,

    @InjectRepository(CashEntity) private readonly cashRepo: CashRepository,
    private readonly bcrypt: BcryptEncryption,

    private readonly token: Token,
    private readonly dataSource: DataSource,
  ) {}

  async createMarket(createMarketDto: CreateMarketDto): Promise<object> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { market_name, phone_number, tariff, password } = createMarketDto;
      const existMarket = await queryRunner.manager.findOne(MarketEntity, {
        where: { phone_number },
      });
      if (existMarket) {
        throw new ConflictException(
          'Market with this phone number already exist',
        );
      }
      const hashedPassword = await this.bcrypt.encrypt(password);
      const newMarket = queryRunner.manager.create(MarketEntity, {
        market_name,
        phone_number,
        tariff,
        password: hashedPassword,
      });
      await queryRunner.manager.save(newMarket);

      const cashbox = queryRunner.manager.create(CashEntity, {
        cashbox_type: Cashbox_type.FOR_MARKET,
        user_id: newMarket.id,
      });
      await queryRunner.manager.save(cashbox);

      await queryRunner.commitTransaction();
      return successRes(newMarket, 201, 'New market created');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return catchError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<object> {
    try {
      const allMarkets = await this.marketRepo.find({
        select: ['id', 'market_name', 'phone_number', 'status', 'created_at'],
      });
      return successRes(allMarkets, 200, 'All markets');
    } catch (error) {
      return catchError(error);
    }
  }

  async findOne(id: string): Promise<object> {
    try {
      const market = await this.marketRepo.findOne({ where: { id } });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      return successRes(market, 200, 'Market by id');
    } catch (error) {
      return catchError(error);
    }
  }

  async update(id: string, updateMarketDto: UpdateMarketDto): Promise<object> {
    try {
      const { password, ...otherFields } = updateMarketDto;
      const market = await this.marketRepo.findOne({ where: { id } });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      let hashedPassword: string | undefined;
      if (password) {
        hashedPassword = await this.bcrypt.encrypt(password);
      }

      await this.marketRepo.update(
        { id },
        { ...otherFields, ...(hashedPassword && { password: hashedPassword }) },
      );
      const updatedMarket = await this.marketRepo.findOne({ where: { id } });
      return successRes(updatedMarket, 200, 'Market updated');
    } catch (error) {
      return catchError(error);
    }
  }

  async remove(id: string): Promise<object> {
    try {
      const market = await this.marketRepo.findOne({ where: { id } });
      if (!market) {
        throw new NotFoundException('Market not found');
      }
      await this.marketRepo.delete({ id });
      return successRes({}, 200, 'Market deleted');
    } catch (error) {
      return catchError(error);
    }
  }

  async marketLogin(
    loginMarketDto: LoginMarketDto,
    res: Response,
  ): Promise<object> {
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
      writeToCookie(res, 'refreshTokenMarket', refreshTokenMarket);
      return successRes(accessTokenMarket, 200, 'Successfully logged in');
    } catch (error) {
      return catchError(error);
    }
  }

  async signOut(res: Response): Promise<object> {
    try {
      res.clearCookie('refreshTokenMarket');
      return successRes({}, 200, 'Logged out');
    } catch (error) {
      return catchError(error);
    }
  }
}
