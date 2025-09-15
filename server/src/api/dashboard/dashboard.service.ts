import { Injectable } from '@nestjs/common';
import { OrderService } from '../order/order.service';
import { catchError, successRes } from 'src/infrastructure/lib/response';

@Injectable()
export class DashboardService {
  constructor(private readonly orderStats: OrderService) {}
  async getOverview(filter: { startDate?: string; endDate?: string }) {
    try {
      let { startDate, endDate } = filter;

      if (!startDate && !endDate) {
        const today = new Date();
        const start = new Date(today.setHours(0, 0, 0, 0));
        const end = new Date(today.setHours(23, 59, 59, 999));

        startDate = start.toISOString();
        endDate = end.toISOString();
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
}
