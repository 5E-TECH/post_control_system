import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';

export interface MarketplaceRequest extends Request {
  marketplaceIntegration?: MarketplaceIntegrationEntity;
}

/**
 * MARKETPLACE O'QISH ENDPOINTLARI UCHUN QO'RIQCHI.
 *
 * ⚠️ NEGA `slug` URL'DA. Kalit bazada SHIFRLANGAN saqlanadi (AES-256-GCM,
 * har safar TASODIFIY IV bilan). Ya'ni `WHERE inbound_api_key = $1` HECH
 * QACHON mos kelmaydi — bir xil matn har safar boshqa shifrmatn beradi.
 *
 * Uch yo'ldan biri kerak edi:
 *   (a) kalit HASH'ini alohida ustunda saqlash — qo'shimcha ustun + migratsiya;
 *   (b) barcha integratsiyalarni yuklab, deshifrlab solishtirish — kalit
 *       sonidan qat'i nazar har so'rovda butun jadval;
 *   (c) `slug` bo'yicha topib, keyin kalitni solishtirish.
 *
 * (c) tanlandi: bitta indeksli qidiruv, URL o'zini tushuntiradi va
 * qo'shimcha ustun kerak emas.
 *
 * ⚠️ Taqqoslash DOIMIY VAQTLI — kalit uzunligi yoki prefiksi bo'yicha
 * sizib chiqmasin.
 */
@Injectable()
export class MarketplaceApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(MarketplaceApiKeyGuard.name);

  constructor(
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<MarketplaceRequest>();
    const slug = String(req.params?.slug ?? '').trim();
    const provided = String(req.headers['x-api-key'] ?? '');

    if (!slug || !provided) {
      throw new UnauthorizedException('X-Api-Key yoki slug yo\'q');
    }

    const integration = await this.integrationRepo.findOne({ where: { slug } });
    if (!integration || !integration.is_active) {
      // ⚠️ «Topilmadi» va «o'chirilgan» ni AJRATMAYMIZ — qaysi slug'lar
      // mavjudligini tashqaridan sanab chiqishga yo'l qolmasin.
      throw new UnauthorizedException('Kirish rad etildi');
    }

    if (!integration.inbound_api_key) {
      this.logger.error(`${slug}: kiruvchi API kalit sozlanmagan`);
      throw new UnauthorizedException('Kirish rad etildi');
    }

    if (!safeEqual(provided, integration.inbound_api_key)) {
      this.logger.warn(`${slug}: noto'g'ri API kalit bilan urinish`);
      throw new UnauthorizedException('Kirish rad etildi');
    }

    // ── IP oq ro'yxati (bo'sh bo'lsa cheklov yo'q) ──
    const allow = integration.ip_allowlist ?? [];
    if (allow.length > 0) {
      const ip = clientIp(req);
      if (!allow.includes(ip)) {
        this.logger.warn(`${slug}: ro'yxatda yo'q IP dan urinish (${ip})`);
        throw new ForbiddenException('Bu IP manzilga ruxsat yo\'q');
      }
    }

    req.marketplaceIntegration = integration;
    return true;
  }
}

/**
 * ⚠️ Uzunlik farqi ham sizib chiqmasin: `timingSafeEqual` har xil
 * uzunlikda XATO tashlaydi, shu bois avval uzunlikni tekshiramiz va
 * teng bo'lmasa ham TO'LIQ taqqoslashni bajaramiz.
 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // Bir xil uzunlikdagi soxta taqqoslash — vaqt bo'yicha farq qolmasin.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

function clientIp(req: Request): string {
  // `trust proxy` yoqilgani uchun Express `req.ip` ni to'g'ri hisoblaydi.
  return String(req.ip ?? '').replace(/^::ffff:/, '');
}
