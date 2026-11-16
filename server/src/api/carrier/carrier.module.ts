import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarrierAccountEntity } from 'src/core/entity/carrier-account.entity';
import { CarrierIdempotencyKeyEntity } from 'src/core/entity/carrier-idempotency-key.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderItemEntity } from 'src/core/entity/order-item.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { OrderModule } from '../order/order.module';
import { PostModule } from '../post/post.module';
import { CarrierAdminController } from './carrier-admin.controller';
import { CarrierPublicController } from './carrier-public.controller';
import { CarrierAccountService } from './carrier-account.service';
import { CarrierIdempotencyService } from './carrier-idempotency.service';
import { CarrierService } from './carrier.service';
import { CarrierApiKeyGuard } from './guards/carrier-api-key.guard';
import { CarrierIpThrottlerGuard } from './guards/carrier-ip-throttler.guard';
import { CarrierThrottlerGuard } from './guards/carrier-throttler.guard';

/**
 * CARRIER API — tashqi yetkazuvchi kompaniya BeePost'ga Elchi bilan BIR XIL
 * kontrakt orqali ulanadi (`/api/v1/carrier/*`, `X-Api-Key`).
 *
 * Arxitektura: kompaniya = bitta kuryer user. Har so'rov o'sha kuryer
 * nomidan MAVJUD kuryer amallariga yo'naltiriladi (`OrderService.sellOrder`,
 * `partlySold`, `cancelOrder`, `rollbackOrderToWaiting`;
 * `PostService.receiveOrderForCourierById`, `createCanceledPost`) — pul,
 * status mashinasi va egalik tekshiruvi o'zgarishsiz qayta ishlatiladi.
 *
 * ⚠️ B10 TUZOG'I: `OrderService` ni bu yerda PROVIDER QILMAYMIZ — u
 * `OrderModule` dan eksport orqali olinadi. Qayta e'lon qilinsa, uning 20 ta
 * konstruktor bog'liqligini shu modul ham import qilishi kerak bo'lardi
 * (`DashboardModule` dagi kabi) va xato faqat server ishga tushganda chiqardi.
 *
 * ⚠️ Controller TARTIBI: admin (`carrier-accounts`) public (`carrier`) dan
 * oldin — prefikslar to'qnashmaydi, lekin tartib wiring testida qulflangan.
 *
 * `forwardRef` — elchi/ldg modullari bilan bir xil naqsh: `PostModule` →
 * `ElchiCargoModule` → `OrderModule` zanjirida fayl darajasidagi aylanma
 * importda modul `undefined` bo'lib qolmasin.
 *
 * `ActivityLogService` global (`ActivityLogModule` `@Global`), import shart emas.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CarrierAccountEntity,
      CarrierIdempotencyKeyEntity,
      UserEntity,
      OrderEntity,
      OrderItemEntity,
      PostEntity,
      CashEntity,
      CashboxHistoryEntity,
    ]),
    forwardRef(() => OrderModule),
    forwardRef(() => PostModule),
  ],
  controllers: [CarrierAdminController, CarrierPublicController],
  providers: [
    CarrierAccountService,
    CarrierIdempotencyService,
    CarrierService,
    CarrierIpThrottlerGuard,
    CarrierApiKeyGuard,
    CarrierThrottlerGuard,
    BcryptEncryption,
  ],
})
export class CarrierModule {}
