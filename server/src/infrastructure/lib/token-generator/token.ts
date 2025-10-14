import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import config from 'src/config';

@Injectable()
export class Token {
  constructor(private readonly jwtService: JwtService) {}

  async generateAccessToken(payload: object): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: config.ACCESS_TOKEN_KEY,
      expiresIn:
        config.ACCESS_TOKEN_TIME as unknown as JwtSignOptions['expiresIn'], // ✅
    });
  }

  async generateRefreshToken(payload: object): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: config.REFRESH_TOKEN_KEY,
      expiresIn:
        config.REFRESH_TOKEN_TIME as unknown as JwtSignOptions['expiresIn'], // ✅
    });
  }
}
