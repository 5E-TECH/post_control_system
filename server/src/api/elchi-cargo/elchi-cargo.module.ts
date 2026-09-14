import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ElchiConfigEntity } from 'src/core/entity/elchi-config.entity';
import { ElchiShipmentEntity } from 'src/core/entity/elchi-shipment.entity';
import { ElchiWebhookLogEntity } from 'src/core/entity/elchi-webhook-log.entity';
import { ElchiDistrictMapEntity } from 'src/core/entity/elchi-district-map.entity';
import { ElchiSettlementPaymentEntity } from 'src/core/entity/elchi-settlement-payment.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { ElchiApiService } from './elchi-api.service';
import { ElchiConfigService } from './elchi-config.service';
import { ElchiShipmentService } from './elchi-shipment.service';
import { ElchiConfigController } from './elchi-config.controller';
import { ElchiWebhookService } from './elchi-webhook.service';
import { ElchiWebhookController } from './elchi-webhook.controller';
import { ElchiReconcileService } from './elchi-reconcile.service';
import { ElchiAdminService } from './elchi-admin.service';
import { ElchiAdminController } from './elchi-admin.controller';
import { OrderModule } from '../order/order.module';

/**
 * Elchi Pochta integratsiyasi (pilot).
 *
 * Model: Elchi — yetkazish pudratchisi va bizning tizimda bitta VIRTUAL KURYER
 * bo'lib ko'rinadi (`users.external_provider = 'elchi'`). LDG bilan bir xil
 * naqsh — mavjud pochta/sotuv oqimi qayta ishlatiladi, order/kassa mantiqiga
 * tegilmaydi.
 *
 * P2 (shu bosqich): jadvallar + Partner API klienti + sozlash/moslash servisi.
 * Keyingi bosqichlar: P3 jo'natish+darvoza, P4 webhook qabuli,
 * P5 solishtirish, P5a/P5b UI. Reja: docs/integrations/07-pilot.md
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ElchiConfigEntity,
      ElchiShipmentEntity,
      ElchiWebhookLogEntity,
      ElchiDistrictMapEntity,
      ElchiSettlementPaymentEntity,
      DistrictEntity,
      OrderEntity,
      UserEntity,
    ]),
    // Elchi'ning posilka yaratish chaqirig'i og'ir (mijoz + buyurtma + pul
    // sozlash ketma-ket) — shu bois transport timeouti uzun. Aniq qiymat har
    // so'rovda `elchi-api.service.ts` ichida beriladi.
    HttpModule.register({
      timeout: 75_000,
      maxRedirects: 0,
    }),
    // Webhook terminal amallari `OrderService`ni chaqiradi. `forwardRef` —
    // PostModule → ElchiCargoModule → OrderModule zanjirida aylanma
    // bog'liqlikni uzish uchun (LDG modulida ham xuddi shunday).
    forwardRef(() => OrderModule),
  ],
  controllers: [
    ElchiConfigController,
    ElchiWebhookController,
    ElchiAdminController,
  ],
  providers: [
    ElchiApiService,
    ElchiConfigService,
    ElchiShipmentService,
    ElchiWebhookService,
    ElchiReconcileService,
    ElchiAdminService,
  ],
  exports: [
    ElchiApiService,
    ElchiConfigService,
    ElchiShipmentService,
    ElchiReconcileService,
  ],
})
export class ElchiCargoModule {}
