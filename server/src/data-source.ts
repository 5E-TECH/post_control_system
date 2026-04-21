/**
 * TypeORM CLI uchun standalone DataSource.
 * Faqat migration komandalari uchun ishlatiladi (npm run migration:*).
 * Application runtime'da ishlatilmaydi — u app.module.ts dan TypeOrmModule orqali ko'tariladi.
 *
 * IMPORTANT: synchronize HAR DOIM false. Migration orqali o'zgartiring.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import config from './config';

export default new DataSource({
  type: 'postgres',
  url: config.DB_URL,
  entities: [__dirname + '/core/entity/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
