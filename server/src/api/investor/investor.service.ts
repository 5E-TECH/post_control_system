import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { OrderService } from '../order/order.service';
import { CashBoxService } from '../cash-box/cash-box.service';
import { RegionService } from '../region/region.service';
import { successRes } from 'src/infrastructure/lib/response';
import { OrderEntity } from 'src/core/entity/order.entity';
import { FinancialSource_type, Order_status } from 'src/common/enums';
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
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
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
      // Default: BUTUN biznes tarixi (filtrsiz landing bo'sh/0 ko'rinmasin).
      return { start: '0', end: String(today.end) };
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

  // epoch-ms → 'YYYY-MM-DD' (Toshkent, UTC+5).
  private toYmd(ms: number): string {
    const uz = new Date(ms + 5 * 60 * 60 * 1000);
    return `${uz.getUTCFullYear()}-${String(uz.getUTCMonth() + 1).padStart(2, '0')}-${String(uz.getUTCDate()).padStart(2, '0')}`;
  }

  // ---- 1. Biznes umumiy ko'rinishi (buyurtma statuslari + foyda) ----
  async getOverview(startDate?: string, endDate?: string) {
    const { start, end } = this.resolveRange(startDate, endDate);
    const data = await this.cached(`overview:${start}:${end}`, async () => {
      const res: any = await this.orderService.getStats(start, end);
      const d = res?.data ?? {};
      // "Sof foyda (davr)" — HAQIQIY sof foyda (TO'LIQ marja − OpEx), net-profit
      // sahifasi va my-investment bilan izchil. Buyurtma sanoqlari getStats'dan.
      const pb = await this.computeProfitBreakdown(startDate, endDate);
      return {
        acceptedCount: this.num(d.acceptedCount),
        soldAndPaid: this.num(d.soldAndPaid),
        cancelled: this.num(d.cancelled),
        profit: pb.netProfit, // sof foyda (davr)
        grossProfit: pb.grossProfit, // yalpi marja (davr)
        totalOpEx: pb.totalOpEx, // umumiy xarajat (davr)
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
      const points = series.map((p: any) => ({
        period: p.period,
        label: p.label,
        ordersCount: this.num(p.ordersCount),
        revenue: this.num(p.revenue),
      }));
      // Period-over-period o'sish % (oldingi nuqta 0 yoki yo'q bo'lsa null).
      const withGrowth = points.map((p: any, i: number) => {
        const prev = i > 0 ? points[i - 1].revenue : null;
        const growthPct =
          prev !== null && prev !== 0
            ? Math.round(((p.revenue - prev) / Math.abs(prev)) * 10000) / 100
            : null;
        return { ...p, growthPct };
      });
      return {
        period,
        data: withGrowth,
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

  // ---- Sof foyda / OpEx uchun ichki hisob (financial_balance_history'dan) ----
  // negativeImpact allaqachon MUSBAT magnitude (SUM(-1*amount)). Shuning uchun:
  //   netProfit = sellProfit − (salary + bills + manualExpense)
  // MANUAL_INCOME va CORRECTION ATAYLAB kiritilmaydi (kelishilgan formula).
  private async computeProfitBreakdown(startDate?: string, endDate?: string) {
    // Oraliqni BIR marta hal qilamiz — gross va OpEx AYNAN bir xil oraliqda
    // bo'lishi shart (aks holda gross=bugun, opex=butun-tarix kabi nomuvofiqlik
    // → −390000 kabi mantiqsiz sof foyda kelib chiqadi).
    const { start, end } = this.resolveRange(startDate, endDate);
    const sd = this.toYmd(Number(start));
    const ed = this.toYmd(Number(end));

    // YALPI marja — TO'LIQ manba (getRevenueStats raw LEFT JOIN). getStats EMAS:
    // u relation-join sabab kam sanaydi; my-investment sahifasi bilan bir xil bo'lsin.
    const revRes: any = await this.orderService.getRevenueStats('daily', sd, ed);
    const series: any[] = revRes?.data?.data ?? [];
    const grossProfit = series.reduce((a, p) => a + this.num(p.revenue), 0);

    // OpEx — FBH manfiylari, AYNAN bir xil (sd..ed) oraliqda.
    const res: any = await this.cashBoxService.financialBalanceAnalytics({
      fromDate: sd,
      toDate: ed,
    });
    const d = res?.data ?? {};
    const neg = Array.isArray(d.negativeImpact) ? d.negativeImpact : [];
    const findNeg = (t: string) =>
      this.num(neg.find((s: any) => s.source_type === t)?.total_amount);

    const salary = findNeg(FinancialSource_type.SALARY);
    const bills = findNeg(FinancialSource_type.BILLS);
    const manualExpense = findNeg(FinancialSource_type.MANUAL_EXPENSE);
    const totalOpEx = salary + bills + manualExpense;
    const netProfit = grossProfit - totalOpEx;
    return { grossProfit, salary, bills, manualExpense, totalOpEx, netProfit };
  }

  // ---- Sof foyda P&L (gross foyda − OpEx). OpEx bitta jami — shaxssiz. ----
  async getNetProfit(startDate?: string, endDate?: string) {
    const key = `net-profit:${startDate ?? ''}:${endDate ?? ''}`;
    const data = await this.cached(key, async () => {
      const b = await this.computeProfitBreakdown(startDate, endDate);
      // DIQQAT (decision #4): xarajat bitta jami raqam sifatida beriladi —
      // salary/bills alohida ko'rsatilmaydi (shaxsiy oyliklar oshkor bo'lmasin).
      return {
        grossProfit: b.grossProfit,
        totalOpEx: b.totalOpEx,
        netProfit: b.netProfit,
        from: startDate ?? null,
        to: endDate ?? null,
      };
    });
    return successRes(data, 200, 'Investor net profit');
  }

  // ---- Umumiy OpEx — BITTA yig'ma raqam (hech qachon shaxs bo'yicha) ----
  async getOpEx(startDate?: string, endDate?: string) {
    const key = `opex:${startDate ?? ''}:${endDate ?? ''}`;
    const data = await this.cached(key, async () => {
      const b = await this.computeProfitBreakdown(startDate, endDate);
      return { totalOpEx: b.totalOpEx, from: startDate ?? null, to: endDate ?? null };
    });
    return successRes(data, 200, 'Investor total OpEx');
  }

  // sold/paid/partly_paid buyurtmalarning jami savdo hajmi (GMV).
  private async getGrossSold(start: string, end: string): Promise<number> {
    const raw = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_price), 0)', 'gross')
      .where('o.status IN (:...statuses)', {
        statuses: [
          Order_status.SOLD,
          Order_status.PAID,
          Order_status.PARTLY_PAID,
        ],
      })
      .andWhere('o.sold_at IS NOT NULL')
      .andWhere('o.sold_at BETWEEN :start AND :end', {
        start: Number(start),
        end: Number(end),
      })
      .getRawOne();
    return this.num(raw?.gross);
  }

  // Eksport oralig'i cheklovi (exfiltration surface'ini kamaytiradi).
  private assertSpan(startDate?: string, endDate?: string) {
    if (startDate && endDate) {
      const s = toUzbekistanTimestamp(startDate, false);
      const e = toUzbekistanTimestamp(endDate, true);
      if (e - s > 366 * 24 * 3600 * 1000) {
        throw new BadRequestException(
          "Eksport oralig'i 366 kundan oshmasligi kerak",
        );
      }
    }
  }

  // Aggregat Excel eksport (business ko'rsatkichlari — PII yo'q).
  async exportBusinessWorkbook(
    startDate?: string,
    endDate?: string,
  ): Promise<Buffer> {
    this.assertSpan(startDate, endDate);
    const [ov, rev, np, cash, ue, reg]: any[] = await Promise.all([
      this.getOverview(startDate, endDate),
      this.getRevenue('daily', startDate, endDate),
      this.getNetProfit(startDate, endDate),
      this.getCashPosition(),
      this.getUnitEconomics(startDate, endDate),
      this.getRegions(startDate, endDate),
    ]);
    const wb = new ExcelJS.Workbook();

    const s1 = wb.addWorksheet('Overview');
    s1.addRow(['Korsatkich', 'Qiymat']);
    const o = ov.data ?? {};
    s1.addRow(['Sof foyda (davr)', o.profit]);
    s1.addRow(['Qabul qilingan', o.acceptedCount]);
    s1.addRow(['Sotilgan/tolangan', o.soldAndPaid]);
    s1.addRow(['Bekor/qaytgan', o.cancelled]);

    const s2 = wb.addWorksheet('Revenue');
    s2.addRow(['Davr', 'Foyda', 'Buyurtma', 'Osish %']);
    for (const p of (rev.data?.data ?? []).slice(0, 1000)) {
      s2.addRow([p.label, p.revenue, p.ordersCount, p.growthPct]);
    }

    const s3 = wb.addWorksheet('Financials');
    s3.addRow(['Korsatkich', 'Qiymat']);
    s3.addRow(['Gross foyda', np.data?.grossProfit]);
    s3.addRow(['Umumiy OpEx', np.data?.totalOpEx]);
    s3.addRow(['Sof foyda', np.data?.netProfit]);
    s3.addRow(['Sof naqd pozitsiya', cash.data?.netCashPosition]);
    s3.addRow(['Naqd', cash.data?.cash]);
    s3.addRow(['Karta', cash.data?.card]);
    s3.addRow(['Buyurtmaga foyda', ue.data?.revenuePerOrder]);
    s3.addRow(['Take-rate %', ue.data?.takeRatePct]);
    s3.addRow(['GMV', ue.data?.grossSold]);

    const s4 = wb.addWorksheet('Regions');
    s4.addRow(['Region', 'Buyurtma', 'Yetkazilgan', 'Bekor', 'Foyda', 'Daraja %']);
    for (const r of reg.data?.regions ?? []) {
      s4.addRow([
        r.name,
        r.totalOrders,
        r.deliveredOrders,
        r.cancelledOrders,
        r.totalRevenue,
        r.successRate,
      ]);
    }

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // ---- Unit-economics: buyurtmaga foyda + take-rate ----
  async getUnitEconomics(startDate?: string, endDate?: string) {
    const { start, end } = this.resolveRange(startDate, endDate);
    const data = await this.cached(`unit-econ:${start}:${end}`, async () => {
      const statsRes: any = await this.orderService.getStats(start, end);
      const s = statsRes?.data ?? {};
      // Foyda — TO'LIQ marja (getStats undercount EMAS), boshqa sahifalar bilan izchil.
      const pb = await this.computeProfitBreakdown(startDate, endDate);
      const totalProfit = pb.grossProfit;
      const soldOrders = this.num(s.soldAndPaid);
      const grossSold = await this.getGrossSold(start, end);
      return {
        totalProfit,
        soldOrders,
        grossSold,
        revenuePerOrder:
          soldOrders > 0 ? Math.round(totalProfit / soldOrders) : null,
        takeRatePct:
          grossSold > 0
            ? Math.round((totalProfit / grossSold) * 10000) / 100
            : null,
        from: this.num(s.from),
        to: this.num(s.to),
      };
    });
    return successRes(data, 200, 'Investor unit economics');
  }
}
