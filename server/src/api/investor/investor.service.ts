import { Injectable } from '@nestjs/common';
import { OrderService } from '../order/order.service';
import { CashBoxService } from '../cash-box/cash-box.service';
import { RegionService } from '../region/region.service';
import { successRes } from 'src/infrastructure/lib/response';
import {
  getUzbekistanDayRange,
  toUzbekistanTimestamp,
} from 'src/common/utils/date.util';

type RevenuePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Investor (ulushdor) uchun FAQAT-O'QISH aggregat servisi.
 *
 * Muhim xavfsizlik qoidasi: bu servis mavjud aggregat metodlarni chaqiradi, lekin
 * ularning natijasini XOM holicha qaytarmaydi — har bir javob QO'LDA "safe map"
 * qilinadi (faqat ma'lum, xavfsiz maydonlar). Loyihada global serializatsiya
 * (@Exclude/ClassSerializerInterceptor) yo'q, shuning uchun maydon-oqishning
 * yagona to'sig'i shu qo'lda mapping. Mijoz PII, xodim oyliklari, karta raqamlari,
 * per-entity massivlar — hech qachon qaytarilmaydi.
 */
@Injectable()
export class InvestorService {
  constructor(
    private readonly orderService: OrderService,
    private readonly cashBoxService: CashBoxService,
    private readonly regionService: RegionService,
  ) {}

  // 5-daqiqali oddiy TTL kesh (biznes aggregatlari uchun; DB yukini kamaytiradi).
  private readonly cache = new Map<string, { data: any; expireAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.expireAt > now) return hit.data;
    const data = await fn();
    this.cache.set(key, { data, expireAt: now + this.CACHE_TTL });
    return data;
  }

  // DashboardService.resolveRange ning ochiq replikasi (u private edi).
  // getStats epoch-ms STRING kutadi. Asia/Tashkent bo'yicha.
  private resolveRange(
    startDate?: string,
    endDate?: string,
  ): { start: string; end: string } {
    const today = getUzbekistanDayRange();
    if (!startDate && !endDate) {
      return { start: String(today.start), end: String(today.end) };
    }
    if (startDate && !endDate) {
      return {
        start: String(toUzbekistanTimestamp(startDate, false)),
        end: String(today.end),
      };
    }
    if (!startDate && endDate) {
      return { start: '0', end: String(toUzbekistanTimestamp(endDate, true)) };
    }
    return {
      start: String(toUzbekistanTimestamp(startDate as string, false)),
      end: String(toUzbekistanTimestamp(endDate as string, true)),
    };
  }

  private num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // ---- 1. Biznes umumiy ko'rinishi (buyurtma statuslari + foyda) ----
  async getOverview(startDate?: string, endDate?: string) {
    const { start, end } = this.resolveRange(startDate, endDate);
    const data = await this.cached(`overview:${start}:${end}`, async () => {
      const res: any = await this.orderService.getStats(start, end);
      const d = res?.data ?? {};
      return {
        acceptedCount: this.num(d.acceptedCount),
        soldAndPaid: this.num(d.soldAndPaid),
        cancelled: this.num(d.cancelled),
        profit: this.num(d.profit),
        from: this.num(d.from),
        to: this.num(d.to),
      };
    });
    return successRes(data, 200, 'Investor overview');
  }

  // ---- 2. Daromad/foyda time-series (getRevenueStats YYYY-MM-DD kutadi) ----
  async getRevenue(
    period: RevenuePeriod = 'daily',
    startDate?: string,
    endDate?: string,
  ) {
    const key = `revenue:${period}:${startDate ?? ''}:${endDate ?? ''}`;
    const data = await this.cached(key, async () => {
      const res: any = await this.orderService.getRevenueStats(
        period,
        startDate,
        endDate,
      );
      const d = res?.data ?? {};
      const series = Array.isArray(d.data) ? d.data : [];
      return {
        period,
        data: series.map((p: any) => ({
          period: p.period,
          label: p.label,
          ordersCount: this.num(p.ordersCount),
          revenue: this.num(p.revenue),
        })),
        summary: {
          totalRevenue: this.num(d.summary?.totalRevenue),
          totalOrders: this.num(d.summary?.totalOrders),
          avgRevenue: this.num(d.summary?.avgRevenue),
        },
      };
    });
    return successRes(data, 200, `Investor revenue (${period})`);
  }

  // ---- 3. Buyurtma oqimi (getStats'dan muvaffaqiyat/qaytish darajasi) ----
  async getOrderFlow(startDate?: string, endDate?: string) {
    const { start, end } = this.resolveRange(startDate, endDate);
    const data = await this.cached(`orderflow:${start}:${end}`, async () => {
      const res: any = await this.orderService.getStats(start, end);
      const d = res?.data ?? {};
      const soldAndPaid = this.num(d.soldAndPaid);
      const cancelled = this.num(d.cancelled);
      const closed = soldAndPaid + cancelled;
      return {
        acceptedCount: this.num(d.acceptedCount),
        soldAndPaid,
        cancelled,
        successRate: closed > 0 ? Math.round((soldAndPaid / closed) * 100) : 0,
        returnRate: closed > 0 ? Math.round((cancelled / closed) * 100) : 0,
        from: this.num(d.from),
        to: this.num(d.to),
      };
    });
    return successRes(data, 200, 'Investor order flow');
  }

  // ---- 4. Regional statistika (allaqachon aggregat — xarita uchun) ----
  async getRegions(startDate?: string, endDate?: string) {
    const key = `regions:${startDate ?? ''}:${endDate ?? ''}`;
    const data = await this.cached(key, async () => {
      const res: any = await this.regionService.getAllRegionsStats({
        startDate,
        endDate,
      });
      const d = res?.data ?? {};
      const regions = Array.isArray(d.regions) ? d.regions : [];
      return {
        regions: regions.map((r: any) => ({
          id: r.id,
          name: r.name,
          satoCode: r.satoCode,
          districtsCount: this.num(r.districtsCount),
          couriersCount: this.num(r.couriersCount),
          totalOrders: this.num(r.totalOrders),
          deliveredOrders: this.num(r.deliveredOrders),
          cancelledOrders: this.num(r.cancelledOrders),
          pendingOrders: this.num(r.pendingOrders),
          totalRevenue: this.num(r.totalRevenue),
          successRate: this.num(r.successRate),
        })),
        summary: {
          totalRegions: this.num(d.summary?.totalRegions),
          totalOrders: this.num(d.summary?.totalOrders),
          totalDelivered: this.num(d.summary?.totalDelivered),
          totalCancelled: this.num(d.summary?.totalCancelled),
          totalRevenue: this.num(d.summary?.totalRevenue),
          avgSuccessRate: this.num(d.summary?.avgSuccessRate),
        },
      };
    });
    return successRes(data, 200, 'Investor region stats');
  }

  // ---- 5. Anonim reyting (id/ism yashiriladi — faqat rank + ko'rsatkichlar) ----
  async getLeaderboards() {
    const data = await this.cached('leaderboards', async () => {
      const [marketsRes, couriersRes]: [any, any] = await Promise.all([
        this.orderService.getTopMarkets(10),
        this.orderService.getTopCouriers(10),
      ]);
      // Faqat rank + ko'rsatkichlar olinadi; market_id/market_name va
      // courier_id/courier_name ATAYLAB tanlanmaydi (anonim reyting).
      const anon = (rows: any) =>
        (Array.isArray(rows) ? rows : []).map((r: any, i: number) => ({
          rank: i + 1,
          totalOrders: this.num(r.total_orders),
          successfulOrders: this.num(r.successful_orders),
          successRate: this.num(r.success_rate),
        }));
      return {
        markets: anon(marketsRes?.data),
        couriers: anon(couriersRes?.data),
      };
    });
    return successRes(data, 200, 'Investor leaderboards (anonymized, 30d)');
  }

  // ---- 6. Joriy naqd pozitsiya (financialBalance — nuqta-vaqt) ----
  async getCashPosition() {
    const data = await this.cached('cash-position', async () => {
      const res: any = await this.cashBoxService.financialBalance();
      const d = res?.data ?? {};
      const main = d.main ?? {};
      // DIQQAT: allMarketCashboxes / allCourierCashboxes (per-entity massivlar)
      // ATAYLAB qaytarilmaydi — faqat skalyar jamlanmalar.
      return {
        netCashPosition: this.num(d.currentSituation),
        cash: this.num(main.balance_cash),
        card: this.num(main.balance_card),
        mainBalance: this.num(main.balance),
        couriersTotal: this.num(d.couriers?.couriersTotalBalanse),
        marketsTotal: this.num(d.markets?.marketsTotalBalans),
        asOf: Date.now(),
      };
    });
    return successRes(data, 200, 'Investor cash position (current)');
  }
}
