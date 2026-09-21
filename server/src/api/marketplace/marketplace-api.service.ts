import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { MarketplaceIntegrationEntity } from 'src/core/entity/marketplace-integration.entity';
import { buildSignatureHeader } from './utils/marketplace-signature.util';
import { assertOutboundUrlSafe, joinUrl } from './utils/marketplace-url.util';
import {
  classifyMarketplaceError,
  MarketplaceCircuitBreaker,
  MarketplaceErrorInfo,
} from './utils/marketplace-error.util';

/**
 * MARKETPLACE HTTP KLIENTI — bizdan ularga ketadigan YAGONA yo'l.
 *
 * Nima qiladi:
 *   · har so'rovni HMAC bilan imzolaydi (kontrakt §3.2);
 *   · SSRF qo'riqchisidan o'tkazadi (repoda bunday himoya yo'q edi);
 *   · timeout'ni integratsiya sozlamasidan oladi;
 *   · xatoni TASNIFLAYDI — «topilmadi» va «server o'lgan» aralashmaydi;
 *   · ketma-ket xatolarda circuit breaker'ni ochadi.
 *
 * ⚠️ NEGA `ElchiApiService` NUSXA OLINMADI. U singleton sozlamaga (bitta
 * `elchi_config` qatori) qattiq bog'langan va imzolamaydi. Bu yerda esa
 * ko'p-ijarali (`slug` bo'yicha) va imzolaydigan klient kerak.
 */
@Injectable()
export class MarketplaceApiService {
  private readonly logger = new Logger(MarketplaceApiService.name);

  /**
   * Har integratsiya uchun alohida breaker.
   * ⚠️ Jarayon ichida — ko'p instansda har biri o'zinikini yuritadi. Bu
   * ataylab: breaker operator oqimini himoyalaydi, global holat emas.
   */
  private readonly breakers = new Map<string, MarketplaceCircuitBreaker>();

  constructor(private readonly http: HttpService) {}

  private breakerFor(slug: string): MarketplaceCircuitBreaker {
    let b = this.breakers.get(slug);
    if (!b) {
      b = new MarketplaceCircuitBreaker();
      this.breakers.set(slug, b);
    }
    return b;
  }

  /** Skan navbati to'xtatilganmi (UI shunga qarab ogohlantiradi). */
  isPaused(slug: string): boolean {
    return this.breakerFor(slug).isOpen();
  }

  /**
   * To'xtatish tugashiga qancha SONIYA qolgani (to'xtatilmagan bo'lsa 0).
   */
  pausedSecondsLeft(slug: string): number {
    const b = this.breakerFor(slug);
    if (!b.isOpen()) return 0;
    return Math.ceil(b.msUntilClose() / 1000);
  }

  resumeQueue(slug: string): void {
    this.breakerFor(slug).recordSuccess();
  }

  // ═══════════════════ UMUMIY SO'ROV ═══════════════════

  /**
   * ⚠️ `body` AVVAL bir marta `JSON.stringify` qilinadi va AYNI SATR ham
   * imzolanadi, ham tanaga beriladi. Qayta stringify qilish (masalan axios
   * o'zi obyektni serializatsiya qilishi) imzoni jimgina buzardi — bu
   * kontraktdagi eng ko'p uchraydigan xato.
   */
  private async request<T>(
    integration: MarketplaceIntegrationEntity,
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{ data: T; status: number }> {
    if (!integration.is_active) {
      throw new ServiceUnavailableException(
        `Marketplace ulanishi o'chirilgan: ${integration.slug}`,
      );
    }
    if (!integration.api_base_url) {
      throw new ServiceUnavailableException(
        `Marketplace manzili sozlanmagan: ${integration.slug}`,
      );
    }

    const url = joinUrl(integration.api_base_url, path);
    assertOutboundUrlSafe(url);

    const raw = body === undefined ? '' : JSON.stringify(body);
    const requestId = randomUUID();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': integration.api_key ?? '',
      'X-Request-Id': requestId,
    };

    // `ping` dan tashqari hamma so'rov imzolanadi.
    if (integration.signing_secret && path !== '/bp/v1/ping') {
      headers['X-BeePost-Signature'] = buildSignatureHeader(
        integration.signing_secret,
        raw,
        { previousSecret: integration.signing_secret_previous },
      );
    }

    const timeout = integration.request_timeout_ms || 15000;

    try {
      const res = await firstValueFrom(
        method === 'GET'
          ? this.http.get<T>(url, { headers, timeout, maxRedirects: 0 })
          : this.http.post<T>(url, raw, { headers, timeout, maxRedirects: 0 }),
      );
      this.breakerFor(integration.slug).recordSuccess();
      return { data: res.data, status: res.status };
    } catch (err) {
      const info = classifyMarketplaceError(err);
      const opened = this.breakerFor(integration.slug).recordFailure(info);
      if (opened) {
        this.logger.error(
          `⛔ ${integration.slug}: ketma-ket xatolar sabab navbat TO'XTATILDI (${info.kind})`,
        );
      }
      // Tasnifni xatoga yopishtiramiz — chaqiruvchi matn parse qilmasin.
      (err as { marketplaceError?: MarketplaceErrorInfo }).marketplaceError = info;
      throw err;
    }
  }

  // ═══════════════════ KONTRAKT ENDPOINTLARI ═══════════════════

  /** §4.1 — salomatlik. Admin panelidagi «Ulanishni tekshirish» tugmasi. */
  async ping(integration: MarketplaceIntegrationEntity) {
    const t0 = Date.now();
    const r = await this.request<{ ok: boolean; version?: string }>(
      integration,
      'GET',
      '/bp/v1/ping',
    );
    return { ...r.data, latency_ms: Date.now() - t0 };
  }

  /**
   * §4.2 — QR bo'yicha posilka. HAR SKANDA chaqiriladi.
   *
   * ⚠️ Manifest qurilmagani uchun (qaror O4) bu endpoint qabul jarayonining
   * YAGONA bog'lanish nuqtasi — shu bois breaker aynan shu yerda muhim.
   */
  async lookupParcel(
    integration: MarketplaceIntegrationEntity,
    qrTokenRaw: string,
    operatorRef?: string,
  ) {
    const r = await this.request<Record<string, unknown>>(
      integration,
      'POST',
      '/bp/v1/parcels/lookup',
      {
        qr_token: qrTokenRaw,
        scanned_at: Date.now(),
        ...(operatorRef ? { operator_ref: operatorRef } : {}),
      },
    );
    return r.data;
  }

  /** §4.3 — qabulni tasdiqlash. `batch_id` bo'yicha idempotent. */
  async confirmAccept(
    integration: MarketplaceIntegrationEntity,
    payload: {
      batch_id: string;
      accepted_at: number;
      branch?: { region_sato?: string; name?: string };
      items: Array<{
        external_parcel_id: string;
        beepost_order_id?: string;
        beepost_order_number?: number;
      }>;
      rejected?: Array<{ external_parcel_id: string; reason: string; note?: string }>;
    },
  ) {
    const r = await this.request<{
      accepted: string[];
      rejected: string[];
      errors: Array<{ external_parcel_id: string; code: string }>;
    }>(integration, 'POST', '/bp/v1/parcels/accept', payload);
    return r.data;
  }

  /** §4.4 — hodisa. Outbox worker chaqiradi. */
  async sendEvent(
    integration: MarketplaceIntegrationEntity,
    envelope: Record<string, unknown>,
  ) {
    const r = await this.request<{
      ok: boolean;
      applied?: boolean;
      reason?: string;
      current_seq?: number;
      receipt_id?: string;
    }>(integration, 'POST', '/bp/v1/events', envelope);
    return { ...r.data, http_status: r.status };
  }

  /** §4.5 — solishtiruv. 15-daqiqalik CRON chaqiradi. */
  async fetchParcelStatuses(
    integration: MarketplaceIntegrationEntity,
    query: { ids?: string[]; updatedSince?: number; limit?: number; cursor?: string },
  ) {
    const p = new URLSearchParams();
    if (query.ids?.length) p.set('ids', query.ids.join(','));
    if (query.updatedSince) p.set('updated_since', String(query.updatedSince));
    if (query.limit) p.set('limit', String(query.limit));
    if (query.cursor) p.set('cursor', query.cursor);

    const r = await this.request<{
      items: Array<{
        external_parcel_id: string;
        status: string;
        status_at?: number;
        last_applied_seq?: number;
        money?: Record<string, number>;
      }>;
      next_cursor: string | null;
    }>(integration, 'GET', `/bp/v1/parcels/status?${p.toString()}`);
    return r.data;
  }

  /** §4.6 — sotuvchilar reestri. Kuniga bir marta. */
  async fetchSellers(
    integration: MarketplaceIntegrationEntity,
    query: { updatedSince?: number; limit?: number; cursor?: string } = {},
  ) {
    const p = new URLSearchParams();
    if (query.updatedSince) p.set('updated_since', String(query.updatedSince));
    if (query.limit) p.set('limit', String(query.limit));
    if (query.cursor) p.set('cursor', query.cursor);

    const r = await this.request<{
      items: Array<{
        seller_id: string;
        name?: string;
        phone?: string;
        is_active?: boolean;
      }>;
      next_cursor: string | null;
    }>(integration, 'GET', `/bp/v1/sellers?${p.toString()}`);
    return r.data;
  }

  /** §4.7 — ularning balans ko'rinishi. Kunlik solishtiruv uchun. */
  async fetchLedgerBalance(
    integration: MarketplaceIntegrationEntity,
    sellerId?: string,
  ) {
    const p = new URLSearchParams();
    if (sellerId) p.set('seller_id', sellerId);

    const r = await this.request<{
      currency: string;
      total_receivable: number;
      as_of?: number;
      sellers?: Array<{ seller_id: string; receivable: number }>;
    }>(integration, 'GET', `/bp/v1/ledger/balance?${p.toString()}`);
    return r.data;
  }
}
