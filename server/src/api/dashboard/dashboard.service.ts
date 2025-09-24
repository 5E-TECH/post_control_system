import { Injectable } from '@nestjs/common';
import { OrderService } from '../order/order.service';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { JwtPayload } from 'src/common/utils/types/user.type';

@Injectable()
export class DashboardService {
  constructor(private readonly orderStats: OrderService) {}
  async getOverview(filter: { startDate?: string; endDate?: string }) {
    try {
      let { startDate, endDate } = filter;

      if (!startDate && !endDate) {
        const today = new Date();
        const start = new Date(today.setHours(0, 0, 0, 0)).getTime();
        const end = new Date(today.setHours(23, 59, 59, 999)).getTime();

        startDate = String(start);
        endDate = String(end);
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

      if (!startDate && !endDate) {
        const today = new Date();
        const start = new Date(today.setHours(0, 0, 0, 0)).getTime();
        const end = new Date(today.setHours(23, 59, 59, 999)).getTime();

        startDate = String(start);
        endDate = String(end);
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

  async getStatsForMarket(filter: { startDate?: string; endDate?: string }) {
    try {
      let { startDate, endDate } = filter;

      if (!startDate && !endDate) {
        const today = new Date();
        const start = new Date(today.setHours(0, 0, 0, 0)).getTime();
        const end = new Date(today.setHours(23, 59, 59, 999)).getTime();

        startDate = String(start);
        endDate = String(end);
      }

      const [markets, topMarkets] = await Promise.all([
        this.orderStats.getMarketStats(startDate, endDate),
        this.orderStats.getTopMarkets(),
      ]);

      return successRes({ markets, topMarkets }, 200, 'Dashboard infos');
    } catch (error) {
      return catchError(error);
    }
  }
}
