import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { MarketplacePublicService } from './marketplace-public.service';
import {
  MarketplaceApiKeyGuard,
  MarketplaceRequest,
} from './guards/marketplace-api-key.guard';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';

/**
 * MARKETPLACE O'QIY OLADIGAN ENDPOINTLAR (kontrakt §5).
 *
 * ⚠️ FAQAT O'QISH (qaror O5). Bu yerda `POST`/`PATCH` YO'Q va bo'lmaydi:
 * posilka bizning qo'limizda bo'lganda uning holati uchun faqat BITTA
 * tomon javobgar bo'lishi kerak.
 *
 * ⚠️ `JwtGuard` EMAS — hamkor JWT ololmaydi. `X-Api-Key` + IP ro'yxati.
 *
 * ⚠️ `@ApiExcludeController` — bu yo'llar ichki Swagger'da ko'rinmaydi;
 * ular uchun alohida hujjat bor (`MARKETPLACE_PARTNER_API.md`).
 */
@ApiExcludeController()
@Controller('marketplace/:slug')
@UseGuards(MarketplaceApiKeyGuard)
export class MarketplacePublicController {
  constructor(private readonly svc: MarketplacePublicService) {}

  private integrationOf(req: MarketplaceRequest): MarketplaceIntegrationEntity {
    // Qo'riqchi o'tkazgan bo'lsa bu doim to'ldirilgan.
    return req.marketplaceIntegration as MarketplaceIntegrationEntity;
  }

  /** §5.1 — bizdagi posilka holati va puli. */
  @Get('parcels/:externalParcelId')
  getParcel(
    @Req() req: MarketplaceRequest,
    @Param('externalParcelId') externalParcelId: string,
  ) {
    return this.svc.getParcel(this.integrationOf(req), externalParcelId);
  }

  /** §5.2 — bizdagi daftar (sotuvchi/sana bo'yicha). */
  @Get('ledger')
  getLedger(
    @Req() req: MarketplaceRequest,
    @Query('seller_id') sellerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.getLedger(this.integrationOf(req), {
      seller_id: sellerId,
      from: from ? Number(from) : undefined,
      to: to ? Number(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  /** §5.3 — yo'qolgan hodisani qayta olish. */
  @Get('events')
  getEvents(
    @Req() req: MarketplaceRequest,
    @Query('since_seq') sinceSeq?: string,
    @Query('external_parcel_id') externalParcelId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getEvents(this.integrationOf(req), {
      since_seq: sinceSeq !== undefined ? Number(sinceSeq) : undefined,
      external_parcel_id: externalParcelId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
