import { Injectable } from '@nestjs/common';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MarketEntity } from 'src/core/entity/market.entity';
import { MarketRepository } from 'src/core/repository/market.repository';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { Token } from 'src/infrastructure/lib/token-generator/token';

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(MarketEntity) private marketRepo: MarketRepository,
    private readonly bcrypt: BcryptEncryption,
    private readonly token: Token,
  ) {}
  create(createMarketDto: CreateMarketDto) {
    return 'This action adds a new market';
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
