import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceLedgerEntryEntity } from 'src/core/entity/marketplace-ledger-entry.entity';
import { MarketplaceOutboxEntity } from 'src/core/entity/marketplace-outbox.entity';
import { MarketplaceParcelEntity } from 'src/core/entity/marketplace-parcel.entity';
import { MarketplaceScanSessionEntity } from 'src/core/entity/marketplace-scan-session.entity';
import { MarketplaceSellerEntity } from 'src/core/entity/marketplace-seller.entity';
import { MarketplaceSettlementEntity } from 'src/core/entity/marketplace-settlement.entity';
import { MarketplaceTariffEntity } from 'src/core/entity/marketplace-tariff.entity';
import { MarketplaceApiService } from './marketplace-api.service';
import { MarketplaceScanService } from './marketplace-scan.service';
import { MarketplaceIntakeService } from './marketplace-intake.service';
import { MarketplaceOutboxService } from './marketplace-outbox.service';
import { MarketplaceOutboxWorker } from './marketplace-outbox.worker';
import { MarketplaceLedgerService } from './marketplace-ledger.service';
import { MarketplaceSyncService } from './marketplace-sync.service';
import { MarketplaceSettlementService } from './marketplace-settlement.service';
import { MarketplaceReconcileService } from './marketplace-reconcile.service';
import { MarketplaceConfigService } from './marketplace-config.service';
import { MarketplaceConfigController } from './marketplace-config.controller';
import { MarketplaceController } from './marketplace.controller';
import { MarketplacePublicController } from './marketplace-public.controller';
import { MarketplacePublicService } from './marketplace-public.service';
import { MarketplaceApiKeyGuard } from './guards/marketplace-api-key.guard';

/**
 * MARKETPLACE MODULI.
 *
 * ⚠️ `OrderService` ga BOG'LANMAYDI. Ikki sabab:
 *   1. Qabul oqimi buyurtmani O'ZI yaratadi — `receiveExternalOrders` ning
 *      yumshoq xulqi rejadagi buglar manbai (batafsil: intake servisi izohi).
 *   2. `OrderService` konstruktoriga bog'liqlik qo'shish `DashboardModule`
 *      dagi dublikat-provider tuzog'ini uyg'otadi (bloker B10): xatoni
 *      `tsc` ham, testlar ham ko'rmaydi — u FAQAT prod deploy'da chiqadi.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceIntegrationEntity,
      MarketplaceTariffEntity,
      MarketplaceSellerEntity,
      MarketplaceParcelEntity,
      MarketplaceScanSessionEntity,
      MarketplaceOutboxEntity,
      MarketplaceLedgerEntryEntity,
      MarketplaceSettlementEntity,
      DistrictEntity,
      CashEntity,
    ]),
    HttpModule,
  ],
  // ⚠️ TARTIB MUHIM: `MarketplaceConfigController` (`marketplace/config/...`)
  // `MarketplaceController` (`marketplace/:slug/...`) DAN OLDIN turadi —
  // aks holda `config` slug sifatida talqin qilinardi.
  controllers: [
    MarketplaceConfigController,
    MarketplaceController,
    MarketplacePublicController,
  ],
  providers: [
    MarketplaceApiService,
    MarketplaceScanService,
    MarketplaceIntakeService,
    MarketplaceOutboxService,
    MarketplaceOutboxWorker,
    MarketplaceLedgerService,
    MarketplaceSyncService,
    MarketplaceSettlementService,
    MarketplacePublicService,
    MarketplaceApiKeyGuard,
    MarketplaceReconcileService,
    MarketplaceConfigService,
  ],
  exports: [
    MarketplaceApiService,
    MarketplaceIntakeService,
    MarketplaceOutboxService,
    MarketplaceLedgerService,
    MarketplaceSyncService,
    MarketplaceSettlementService,
    MarketplaceReconcileService,
    MarketplaceConfigService,
  ],
})
export class MarketplaceModule {}
