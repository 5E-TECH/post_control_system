import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierPenaltyConfigEntity } from 'src/core/entity/courier-penalty-config.entity';
import { CourierPenaltyRuleEntity } from 'src/core/entity/courier-penalty-rule.entity';
import { CourierPenaltyEntryEntity } from 'src/core/entity/courier-penalty-entry.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { CourierPenaltyService } from './courier-penalty.service';
import { CourierPenaltyController } from './courier-penalty.controller';
import { CourierPenaltyAdminController } from './courier-penalty-admin.controller';
import { CourierPenaltyAdminService } from './courier-penalty-admin.service';
import { OrderEntity } from 'src/core/entity/order.entity';

/**
 * KURYER SHTRAF / BONUS moduli.
 *
 * Faza 1: `CourierPenaltyService` — belgilash oqimlari (sotuv, qisman
 * sotuv, bekor) uni chaqirib daftarga yozadi, PULGA TEGMAYDI.
 * `CourierPenaltyController` — kuryerning O'Z muddat sanog'i.
 *
 * Faza 2: `CourierPenaltyAdminService` + `...AdminController` — kechikkanlar
 * ro'yxati, daftar, soya yig'indisi, qoidalar CRUD va shtrafni bekor qilish.
 *
 * Keyingi fazalarda bu yerga admin kontrolleri (qoidalar CRUD, kechikkanlar
 * ro'yxati, shtrafni bekor qilish) va hisobot qo'shiladi.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourierPenaltyConfigEntity,
      CourierPenaltyRuleEntity,
      CourierPenaltyEntryEntity,
      PostEntity,
      OrderEntity,
      UserEntity,
    ]),
  ],
  controllers: [CourierPenaltyController, CourierPenaltyAdminController],
  providers: [CourierPenaltyService, CourierPenaltyAdminService],
  exports: [CourierPenaltyService],
})
export class CourierPenaltyModule {}
