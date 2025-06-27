import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from 'src/config';
import { UsersModule } from './users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { CasheBoxModule } from './cashe-box/cashe-box.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.DB_URL,
      entities: ['dist/core/entity/*.entity{.ts,.js}'],
      synchronize: true,
      autoLoadEntities: true,
    }),
    UsersModule,
    JwtModule.register({ global: true }),
    CasheBoxModule,
  ]
})
export class AppModule {}
