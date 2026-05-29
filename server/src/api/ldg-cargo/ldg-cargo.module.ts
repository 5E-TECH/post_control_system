import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { LdgConfigEntity } from 'src/core/entity/ldg-config.entity';
import { LdgShipmentEntity } from 'src/core/entity/ldg-shipment.entity';
import { LdgWebhookLogEntity } from 'src/core/entity/ldg-webhook-log.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { LdgApiService } from './ldg-api.service';
import { LdgShipmentService } from './ldg-shipment.service';
import { LdgWebhookService } from './ldg-webhook.service';
import { LdgConfigService } from './ldg-config.service';
import { LdgAdminService } from './ldg-admin.service';
import { LdgWebhookController } from './ldg-webhook.controller';
import { LdgConfigController } from './ldg-config.controller';
import { LdgAdminController } from './ldg-admin.controller';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LdgConfigEntity,
      LdgShipmentEntity,
      LdgWebhookLogEntity,
      OrderEntity,
      DistrictEntity,
      UserEntity,
      CashEntity,
    ]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 0,
    }),
    forwardRef(() => OrderModule),
  ],
  controllers: [LdgWebhookController, LdgConfigController, LdgAdminController],
  providers: [
    LdgApiService,
    LdgShipmentService,
    LdgWebhookService,
    LdgConfigService,
    LdgAdminService,
  ],
  exports: [LdgShipmentService, LdgConfigService],
})
export class LdgCargoModule {}
