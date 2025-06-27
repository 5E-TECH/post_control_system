import { ConflictException, Injectable } from '@nestjs/common';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MarketEntity } from 'src/core/entity/market.entity';
import { MarketRepository } from 'src/core/repository/market.repository';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { Roles } from 'src/common/enums';

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

  findAll() {
    return `This action returns all market`;
  }

  findOne(id: number) {
    return `This action returns a #${id} market`;
  }

  update(id: number, updateMarketDto: UpdateMarketDto) {
    return `This action updates a #${id} market`;
  }

  remove(id: number) {
    return `This action removes a #${id} market`;
  }
}
