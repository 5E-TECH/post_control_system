import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierPenaltyConfigEntity } from 'src/core/entity/courier-penalty-config.entity';
import { CourierPenaltyRuleEntity } from 'src/core/entity/courier-penalty-rule.entity';
import { CourierPenaltyEntryEntity } from 'src/core/entity/courier-penalty-entry.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { CourierPenaltyService } from './courier-penalty.service';

/**
 * KURYER SHTRAF / BONUS moduli.
 *
 * Faza 1: faqat `CourierPenaltyService` — belgilash oqimlari (sotuv,
 * qisman sotuv, bekor) uni chaqirib daftarga yozadi, PULGA TEGMAYDI.
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
    ]),
  ],
  providers: [CourierPenaltyService],
  exports: [CourierPenaltyService],
})
export class CourierPenaltyModule {}
