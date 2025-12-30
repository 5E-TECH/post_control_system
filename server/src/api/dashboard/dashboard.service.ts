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
  async getOverview(filter: { startDate?: string; endDate?: string }) {
    try {
      let { startDate, endDate } = filter;

      if (!startDate || !endDate) {
        // Sana berilmagan bo‘lsa — bugungi O‘zbekiston kuni
        const { start, end } = getUzbekistanDayRange();
        startDate = String(start);
        endDate = String(end);
      } else {
        // Ikkalasi bir xil bo‘lsa — 00:00 dan 23:59 gacha olish kerak
        if (startDate === endDate) {
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        } else {
          // Har xil kunlar oralig‘i
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        }
      }

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
      let { startDate, endDate } = filter;

      if (!startDate || !endDate) {
        // Sana berilmagan bo‘lsa — bugungi O‘zbekiston kuni
        const { start, end } = getUzbekistanDayRange();
        startDate = String(start);
        endDate = String(end);
      } else {
        // Ikkalasi bir xil bo‘lsa — 00:00 dan 23:59 gacha olish kerak
        if (startDate === endDate) {
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        } else {
          // Har xil kunlar oralig‘i
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        }
      }

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
      let { startDate, endDate } = filter;

      if (!startDate || !endDate) {
        // Sana berilmagan bo‘lsa — bugungi O‘zbekiston kuni
        const { start, end } = getUzbekistanDayRange();
        startDate = String(start);
        endDate = String(end);
      } else {
        // Ikkalasi bir xil bo‘lsa — 00:00 dan 23:59 gacha olish kerak
        if (startDate === endDate) {
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        } else {
          // Har xil kunlar oralig‘i
          const start = toUzbekistanTimestamp(startDate, false);
          const end = toUzbekistanTimestamp(endDate, true);
          startDate = String(start);
          endDate = String(end);
        }
      }

      const [myStat, markets, topMarkets] = await Promise.all([
        this.orderStats.marketStat(user, startDate, endDate),
        this.orderStats.getMarketStats(startDate, endDate),
        this.orderStats.getTopMarkets(),
      ]);

      // succes response returns
      return successRes(
        { myStat, markets, topMarkets },
        200,
        'Dashboard infos',
      );
    } catch (error) {
      return catchError(error);
    }
  }
}
