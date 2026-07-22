import { Injectable } from '@nestjs/common';
import { OrderService } from '../order/order.service';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { JwtPayload } from 'src/common/utils/types/user.type';
import {
  getUzbekistanDayRange,
  toUzbekistanTimestamp,
} from 'src/common/utils/date.util';
import { MyLogger } from 'src/logger/logger.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly orderStats: OrderService,
    private readonly logger: MyLogger,
  ) {}

  /**
   * Dashboard sana oralig'ini normallashtiradi (Toshkent vaqti, epoch-ms string).
   *  • Ikkalasi ham yo'q → bugungi kun.
   *  • Faqat "dan" (startDate) → o'sha kundan BUGUNGACHA. (Avval ikkalasi ham
   *    bugunga tushib ketardi — mobil "faqat-dan" tanlashda haqiqiy bug edi:
   *    sarlavha "X dan boshlab" der, raqamlar esa bugunni ko'rsatardi.)
   *  • Faqat "gacha" (endDate) → boshidan o'sha kungacha.
   *  • Ikkalasi ham bor → to'liq oraliq (bir xil kun bo'lsa 00:00–23:59).
   */
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

  async getOverview(filter: { startDate?: string; endDate?: string }) {
    try {
      const { start: startDate, end: endDate } = this.resolveRange(
        filter.startDate,
        filter.endDate,
      );

      const [orders, markets, couriers, topMarkets, topCouriers] =
        await Promise.all([
          this.orderStats.getStats(startDate, endDate),
          this.orderStats.getMarketStats(startDate, endDate),
          this.orderStats.getCourierStats(startDate, endDate),
          this.orderStats.getTopMarkets(),
          this.orderStats.getTopCouriers(),
        ]);

      return successRes(
        { orders, markets, couriers, topMarkets, topCouriers },
        200,
        'Dashboard infos',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async getStatsForCourier(
    user: JwtPayload,
    filter: { startDate?: string; endDate?: string },
  ) {
    try {
      const { start: startDate, end: endDate } = this.resolveRange(
        filter.startDate,
        filter.endDate,
      );

      const [myStat, couriers, topCouriers] = await Promise.all([
        this.orderStats.courierStat(user, startDate, endDate),
        this.orderStats.getCourierStats(startDate, endDate),
        this.orderStats.getTopCouriers(),
      ]);

      return successRes(
        { myStat, couriers, topCouriers },
        200,
        'Dashboard infos',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async getStatsForMarket(
    user: JwtPayload,
    filter: { startDate?: string; endDate?: string },
  ) {
    try {
      const { start: startDate, end: endDate } = this.resolveRange(
        filter.startDate,
        filter.endDate,
      );

      const [myStat, markets, topMarkets, topOperators] = await Promise.all([
        this.orderStats.marketStat(user, startDate, endDate),
        this.orderStats.getMarketStats(startDate, endDate),
        this.orderStats.getTopMarkets(),
        this.orderStats.getTopOperatorsByMarket(user),
      ]);

      return successRes(
        { myStat, markets, topMarkets, topOperators },
        200,
        'Dashboard infos',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  async getRevenueStats(
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate?: string,
    endDate?: string,
  ) {
    return this.orderStats.getRevenueStats(
      period || 'daily',
      startDate,
      endDate,
    );
  }
}
