import {
  BadRequestException,
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
      if (!ipAllowed(ip, allow)) {
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

/**
 * IP oq ro'yxati — ANIQ manzil yoki CIDR blok (`91.212.0.0/16`).
 *
 * ⚠️ Avval faqat aniq satr taqqoslanardi. Hamkor bir nechta chiquvchi
 * IP dan foydalansa (odatiy holat: yuk balanslovchi, bir nechta server),
 * admin CIDR yozardi-yu, u HECH QACHON mos kelmasdi — hamkor jimgina
 * 403 olib, sababini bilmasdi.
 */
export function ipAllowed(ip: string, allow: string[]): boolean {
  const addr = normalizeIp(ip);
  for (const raw of allow) {
    const entry = String(raw ?? '').trim();
    if (!entry) continue;
    if (!entry.includes('/')) {
      if (normalizeIp(entry) === addr) return true;
      continue;
    }
    if (ipv4InCidr(addr, entry)) return true;
  }
  return false;
}

/** `::ffff:1.2.3.4` → `1.2.3.4` (Node IPv4-mapped shakli). */
function normalizeIp(ip: string): string {
  const v = String(ip ?? '').trim().toLowerCase();
  const m = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(v);
  return m ? m[1] : v;
}

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  if (a === null || b === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

/**
 * Oq ro'yxat yozuvlarini SOZLASH paytida tekshirish.
 *
 * ⚠️ Yaroqsiz yozuv (`91.212.0.` yoki `10.0.0.0/99`) hech qachon mos
 * kelmaydi — hamkor jimgina 403 oladi va sababi hech qayerda ko'rinmaydi.
 */
export function assertValidIpAllowlist(list: string[]): void {
  const bad: string[] = [];
  for (const raw of list ?? []) {
    const entry = String(raw ?? '').trim();
    if (!entry) continue;
    if (entry.includes('/')) {
      const [base, bits] = entry.split('/');
      const n = Number(bits);
      if (
        ipv4ToInt(base) === null ||
        !Number.isInteger(n) ||
        n < 0 ||
        n > 32
      ) {
        bad.push(entry);
      }
      continue;
    }
    // IPv6 yoki IPv4 — ikkalasi ham ruxsat, lekin shakli tanilishi kerak.
    if (ipv4ToInt(entry) === null && !entry.includes(':')) bad.push(entry);
  }
  if (bad.length) {
    throw new BadRequestException(
      `IP ro'yxatida yaroqsiz yozuv: ${bad.join(', ')}. ` +
        `Aniq manzil (91.212.1.5) yoki blok (91.212.0.0/16) yozing.`,
    );
  }
}
