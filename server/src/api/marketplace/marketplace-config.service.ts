import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Cashbox_type, Roles } from 'src/common/enums';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { MarketplaceTariffEntity } from 'src/core/entity/marketplace-tariff.entity';
import { MarketplaceApiService } from './marketplace-api.service';
import { MarketplaceLedgerService } from './marketplace-ledger.service';
import { isReservedMarketplaceSlug } from './marketplace.enums';
import { assertOutboundUrlSafe } from './utils/marketplace-url.util';

/**
 * ⚠️ SEKRETLAR JAVOBDA HECH QACHON QAYTARILMAYDI.
 *
 * Mavjud `external-integration` yo'li `api_key`/`password` ni GET javobida
 * TO'LIQ qaytaradi. Bu yerda o'sha naqsh TAKRORLANMAYDI: faqat
 * «sozlanganmi» bayrog'i va oxirgi 4 belgi ko'rsatiladi — admin kalit
 * to'g'ri kiritilganini tekshira olsin, lekin kalitning o'zi tarqalmasin.
 */
function maskSecret(value: string | null): { set: boolean; hint: string | null } {
  if (!value) return { set: false, hint: null };
  return { set: true, hint: `••••${value.slice(-4)}` };
}

export interface CreateIntegrationInput {
  name: string;
  slug: string;
  market_id: string;
  api_base_url?: string;
  tariff_center: number;
  tariff_home: number;
  is_sandbox?: boolean;
  settlement_period_days?: number;
  ip_allowlist?: string[];
}

export interface UpdateIntegrationInput {
  name?: string;
  api_base_url?: string;
  api_key?: string;
  request_timeout_ms?: number;
  settlement_period_days?: number;
  ip_allowlist?: string[];
  is_sandbox?: boolean;
}

@Injectable()
export class MarketplaceConfigService {
  private readonly logger = new Logger(MarketplaceConfigService.name);

  constructor(
    @InjectRepository(MarketplaceIntegrationEntity)
    private readonly integrationRepo: Repository<MarketplaceIntegrationEntity>,
    @InjectRepository(MarketplaceTariffEntity)
    private readonly tariffRepo: Repository<MarketplaceTariffEntity>,
    private readonly dataSource: DataSource,
    private readonly api: MarketplaceApiService,
    private readonly ledger: MarketplaceLedgerService,
  ) {}

  // ═══════════════════════ O'QISH ═══════════════════════

  async list() {
    const rows = await this.integrationRepo.find({
      order: { created_at: 'DESC' },
    });
    return Promise.all(rows.map((r) => this.present(r)));
  }

  async getBySlug(slug: string) {
    return this.present(await this.mustFind(slug));
  }

  /**
   * OPERATOR uchun ro'yxat — skan ekrani shuni chaqiradi.
   *
   * ⚠️ NEGA ALOHIDA. `list()` sozlash ma'lumotini beradi va u admin-only.
   * Registrator skan qilishi SHART, lekin u sozlamani ko'rmasligi kerak.
   * Bu yerda faqat «qaysi marketplace'ni skanerlash mumkin» — uchta maydon.
   *
   * Faqat YOQILGAN ulanishlar: o'chirilganiga skan qilish baribir
   * darvozadan o'tmaydi, ro'yxatda ko'rinishi esa chalg'itardi.
   */
  async listForOperator(): Promise<
    Array<{ id: string; name: string; slug: string }>
  > {
    const rows = await this.integrationRepo.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
  }

  /** Sekretsiz ko'rinish + sozlash tayyorligi. */
  private async present(r: MarketplaceIntegrationEntity) {
    const tariff = await this.tariffRepo.findOne({
      where: { integration_id: r.id, effective_to: IsNull() },
    });

    // ⚠️ SOZLASH CHECKLISTI. Yarim sozlangan ulanish eng yomon holat:
    // u panelda «bor» bo'lib turadi, lekin birinchi skanda yiqiladi va
    // operator sababini tushunmaydi. Shuning uchun yoqishdan OLDIN
    // har bir bandni tekshiramiz.
    const checklist = {
      api_base_url: !!r.api_base_url,
      api_key: !!r.api_key,
      signing_secret: !!r.signing_secret,
      inbound_api_key: !!r.inbound_api_key,
      tariff: !!tariff,
      market: !!r.market_id,
    };
    const ready = Object.values(checklist).every(Boolean);

    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      market_id: r.market_id,
      api_base_url: r.api_base_url,
      is_active: r.is_active,
      is_sandbox: r.is_sandbox,
      request_timeout_ms: r.request_timeout_ms,
      settlement_period_days: r.settlement_period_days,
      ip_allowlist: r.ip_allowlist ?? [],
      last_ping_at: r.last_ping_at,
      last_reconcile_at: r.last_reconcile_at,
      last_settlement_at: r.last_settlement_at,
      secrets: {
        api_key: maskSecret(r.api_key),
        signing_secret: maskSecret(r.signing_secret),
        signing_secret_previous: maskSecret(r.signing_secret_previous),
        inbound_api_key: maskSecret(r.inbound_api_key),
      },
      tariff: tariff
        ? {
            version: tariff.version,
            tariff_center: Number(tariff.tariff_center),
            tariff_home: Number(tariff.tariff_home),
            effective_from: tariff.effective_from,
          }
        : null,
      checklist,
      ready,
    };
  }

  // ═══════════════════════ YARATISH ═══════════════════════

  async create(input: CreateIntegrationInput, user: JwtPayload) {
    const slug = String(input.slug ?? '').trim().toLowerCase();

    // ⚠️ BAND SLUG. Ommaviy yo'l `marketplace/:slug/...`, ichki yo'l esa
    // `marketplace/scan-session/:id` — slug route segmentiga to'g'ri
    // kelsa, qaysi marshrut ishlashi ro'yxatga olish TARTIBIGA bog'liq
    // bo'lib qolardi. Bunday xato deploy'dan keyin topiladi.
    if (isReservedMarketplaceSlug(slug)) {
      throw new BadRequestException(
        `«${slug}» band so'z — u tizim yo'llari bilan to'qnashadi. Boshqa nom tanlang.`,
      );
    }
    if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)) {
      throw new BadRequestException(
        "Slug faqat kichik harf, raqam va `-` dan iborat bo'lishi kerak (2–49 belgi)",
      );
    }
    if (await this.integrationRepo.findOne({ where: { slug } })) {
      throw new ConflictException(`Bu slug allaqachon band: ${slug}`);
    }

    const center = Math.trunc(Number(input.tariff_center));
    const home = Math.trunc(Number(input.tariff_home));
    if (!(center > 0) || !(home > 0)) {
      throw new BadRequestException(
        "Tarif musbat bo'lishi shart — tarifsiz qabul qilingan posilka sotuvda noto'g'ri summa yozadi",
      );
    }

    // ⚠️ SSRF guardni SOZLASH paytida chaqiramiz. So'rov paytida ham
    // tekshiriladi, lekin u yerda xato operatorga «skan ishlamadi» bo'lib
    // ko'rinadi — admin esa sababini bu yerda darhol ko'radi.
    if (input.api_base_url) assertOutboundUrlSafe(input.api_base_url);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const market = await qr.manager.findOne(UserEntity, {
        where: { id: input.market_id, role: Roles.MARKET },
      });
      if (!market) throw new NotFoundException('Market topilmadi');

      // ⚠️ Bitta market — bitta marketplace. Aks holda ikki integratsiya
      // bitta kassani bo'lishardi va daftar invarianti
      // (SUM(daftar) == kassa balansi) tamoman ma'nosiz bo'lib qolardi.
      const taken = await qr.manager.findOne(MarketplaceIntegrationEntity, {
        where: { market_id: input.market_id },
      });
      if (taken) {
        throw new ConflictException(
          `«${market.name}» marketi allaqachon «${taken.name}» ulanishiga biriktirilgan`,
        );
      }

      const cashbox = await qr.manager.findOne(CashEntity, {
        where: { user_id: market.id, cashbox_type: Cashbox_type.FOR_MARKET },
      });
      if (!cashbox) {
        throw new BadRequestException(
          "Bu marketda kassa yo'q — avval market kassasini yarating",
        );
      }

      const integration = await qr.manager.save(
        qr.manager.create(MarketplaceIntegrationEntity, {
          name: input.name,
          slug,
          market_id: input.market_id,
          api_base_url: input.api_base_url ?? null,
          is_sandbox: input.is_sandbox ?? false,
          settlement_period_days: input.settlement_period_days ?? 7,
          ip_allowlist: input.ip_allowlist ?? null,
          // ⚠️ YARATILGANDA O'CHIQ. Sekretlar hali kiritilmagan; yoqiq
          // holda yaratilsa birinchi skan tushunarsiz xato bilan yiqilardi.
          is_active: false,
        }),
      );

      await qr.manager.save(
        qr.manager.create(MarketplaceTariffEntity, {
          integration_id: integration.id,
          version: 1,
          tariff_center: center,
          tariff_home: home,
          effective_from: Date.now(),
          created_by: user.id,
          note: "Boshlang'ich tarif",
        }),
      );

      await qr.commitTransaction();
      this.logger.log(`✅ marketplace ulanishi yaratildi: ${slug} (${input.name})`);
      return this.present(integration);
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  // ═══════════════════════ TAHRIRLASH ═══════════════════════

  /**
   * ⚠️ `slug` va `market_id` bu yerda ATAYLAB YO'Q.
   *   - `slug` ommaviy URL'da va hodisalarda ishlatiladi — o'zgartirilsa
   *     marketplace tomondagi sozlama bir zumda ishlamay qoladi;
   *   - `market_id` butun daftar va kassa tarixiga bog'langan — ko'chirilsa
   *     invariant buziladi va eski yozuvlar egasiz qoladi.
   */
  async update(slug: string, patch: UpdateIntegrationInput) {
    const integration = await this.mustFind(slug);
    if (patch.api_base_url) assertOutboundUrlSafe(patch.api_base_url);

    // ⚠️ ANIQ maydonlar — `Object.assign(integration, patch)` EMAS.
    // Halqa bilan yozilsa, DTO'ga kelajakda qo'shilgan har qanday maydon
    // (yoki validatsiyadan o'tib ketgan biri) jimgina entity ustuniga
    // tushardi — `is_active` yoki `slug` ni chetlab o'tish yo'li.
    if (patch.name !== undefined) integration.name = patch.name;
    if (patch.api_base_url !== undefined)
      integration.api_base_url = patch.api_base_url;
    if (patch.api_key !== undefined) integration.api_key = patch.api_key;
    if (patch.request_timeout_ms !== undefined)
      integration.request_timeout_ms = patch.request_timeout_ms;
    if (patch.settlement_period_days !== undefined)
      integration.settlement_period_days = patch.settlement_period_days;
    if (patch.ip_allowlist !== undefined)
      integration.ip_allowlist = patch.ip_allowlist;
    if (patch.is_sandbox !== undefined) integration.is_sandbox = patch.is_sandbox;

    await this.integrationRepo.save(integration);
    return this.present(integration);
  }

  /** MASTER kalit — o'chirilsa skan ham, navbat ham to'xtaydi. */
  async setActive(slug: string, active: boolean) {
    const integration = await this.mustFind(slug);
    if (active) {
      const view = await this.present(integration);
      if (!view.ready) {
        const missing = Object.entries(view.checklist)
          .filter(([, ok]) => !ok)
          .map(([k]) => k);
        throw new BadRequestException(
          `Sozlash tugallanmagan — yoqib bo'lmaydi. Yetishmayotgani: ${missing.join(', ')}`,
        );
      }
    }
    integration.is_active = active;
    await this.integrationRepo.save(integration);
    this.logger.warn(`${active ? "🟢 YOQILDI" : "🔴 O'CHIRILDI"}: ${slug}`);
    return this.present(integration);
  }

  // ═══════════════════════ TARIF ═══════════════════════

  /**
   * Yangi tarif versiyasi. Eskisi YOPILADI, o'chirilmaydi.
   *
   * ⚠️ Yo'ldagi posilkalarga TA'SIR QILMAYDI — ularning tarifi qabul
   * paytida buyurtmaga muzlatilgan. Bu ataylab: tarif o'zgarishi allaqachon
   * hisoblangan pulni qayta yozsa, ikki tomonning daftari ajralib ketardi.
   */
  async setTariff(
    slug: string,
    input: { tariff_center: number; tariff_home: number; note?: string },
    user: JwtPayload,
  ) {
    const integration = await this.mustFind(slug);
    const center = Math.trunc(Number(input.tariff_center));
    const home = Math.trunc(Number(input.tariff_home));
    if (!(center > 0) || !(home > 0)) {
      throw new BadRequestException("Tarif musbat bo'lishi shart");
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const current = await qr.manager.findOne(MarketplaceTariffEntity, {
        where: { integration_id: integration.id, effective_to: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      const now = Date.now();
      if (current) {
        if (
          Number(current.tariff_center) === center &&
          Number(current.tariff_home) === home
        ) {
          throw new BadRequestException("Tarif o'zgarmadi");
        }
        current.effective_to = now;
        await qr.manager.save(current);
      }

      const next = await qr.manager.save(
        qr.manager.create(MarketplaceTariffEntity, {
          integration_id: integration.id,
          version: (current?.version ?? 0) + 1,
          tariff_center: center,
          tariff_home: home,
          effective_from: now,
          created_by: user.id,
          note: input.note ?? null,
        }),
      );
      await qr.commitTransaction();

      this.logger.warn(
        `💱 ${slug}: tarif v${next.version} — markaz ${center}, uy ${home}`,
      );
      return {
        version: next.version,
        tariff_center: center,
        tariff_home: home,
        effective_from: now,
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async tariffHistory(slug: string) {
    const integration = await this.mustFind(slug);
    return this.tariffRepo.find({
      where: { integration_id: integration.id },
      order: { version: 'DESC' },
    });
  }

  // ═══════════════════════ SEKRETLAR ═══════════════════════

  /**
   * Imzo sekretini aylantirish.
   *
   * ⚠️ Eskisi `signing_secret_previous` ga KO'CHADI va biz ikkala imzoni
   * ham yuboramiz (`v1` + `v2`). Marketplace qaysi kalitga o'tganidan
   * qat'i nazar imzo to'g'ri keladi — UZILISH BO'LMAYDI (kontrakt §3.4).
   */
  async rotateSigningSecret(slug: string) {
    const integration = await this.mustFind(slug);
    const next = randomBytes(32).toString('hex');
    integration.signing_secret_previous = integration.signing_secret;
    integration.signing_secret = next;
    await this.integrationRepo.save(integration);

    this.logger.warn(`🔑 ${slug}: imzo sekreti aylantirildi`);
    // ⚠️ Sekret FAQAT SHU YERDA, BIR MARTA qaytariladi. Bazada u
    // shifrlangan, panel esa faqat maskani ko'rsatadi.
    return {
      signing_secret: next,
      warning:
        "Bu sekret BOSHQA KO'RSATILMAYDI. Marketplace'ga hoziroq uzating. " +
        "Eski sekret ular o'tguncha ishlaydi — o'tgach «eskisini tozalash» ni bosing.",
    };
  }

  /** Aylantirish oynasi yopildi — eski sekretni tozalash. */
  async clearPreviousSecret(slug: string) {
    const integration = await this.mustFind(slug);
    integration.signing_secret_previous = null;
    await this.integrationRepo.save(integration);
    this.logger.warn(`🔑 ${slug}: eski imzo sekreti tozalandi`);
    return { ok: true };
  }

  /** Ular BIZGA kirishi uchun kalit (faqat o'qish endpointlari). */
  async rotateInboundKey(slug: string) {
    const integration = await this.mustFind(slug);
    const next = randomBytes(24).toString('hex');
    integration.inbound_api_key = next;
    await this.integrationRepo.save(integration);
    this.logger.warn(`🔑 ${slug}: kiruvchi API kalit aylantirildi`);
    return {
      inbound_api_key: next,
      warning: "Bu kalit BOSHQA KO'RSATILMAYDI. Marketplace'ga uzating.",
    };
  }

  // ═══════════════════════ SINOV ═══════════════════════

  /**
   * «Ulanishni tekshirish» tugmasi.
   *
   * ⚠️ Xato PARTLAMAYDI — u ham natija. Admin nima bo'lganini
   * (URL xatomi, kalit xatomi, ular o'chganmi) ko'rishi kerak.
   */
  async testConnection(slug: string) {
    const integration = await this.mustFind(slug);
    if (!integration.api_base_url) {
      return { ok: false, kind: 'config', message: 'API manzili kiritilmagan' };
    }
    try {
      const res = await this.api.ping(integration);
      integration.last_ping_at = Date.now();
      await this.integrationRepo.save(integration);
      // ⚠️ Ularning `ok: false` javobini O'ZIMIZNIKI bilan bosib
      // ketmaymiz: HTTP 200 qaytgani ularning tizimi sog'lom degani emas.
      return {
        ok: res.ok !== false,
        latency_ms: res.latency_ms,
        version: res.version ?? null,
      };
    } catch (e) {
      const info = (e as { marketplaceError?: { kind: string; message: string } })
        .marketplaceError;
      return {
        ok: false,
        kind: info?.kind ?? 'unknown',
        message: info?.message ?? (e instanceof Error ? e.message : String(e)),
      };
    }
  }

  /** Sozlash dashboardi: tayyorlik + daftar invarianti. */
  async health(slug: string) {
    const integration = await this.mustFind(slug);
    const view = await this.present(integration);
    const invariant = await this.ledger.verifyInvariant(integration.id);
    return { ...view, invariant };
  }

  private async mustFind(slug: string): Promise<MarketplaceIntegrationEntity> {
    const integration = await this.integrationRepo.findOne({ where: { slug } });
    if (!integration) {
      throw new NotFoundException(`Marketplace ulanishi topilmadi: ${slug}`);
    }
    return integration;
  }
}
