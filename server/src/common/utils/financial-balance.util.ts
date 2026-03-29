import { CashEntity } from 'src/core/entity/cash-box.entity';
import { Cashbox_type } from 'src/common/enums';
import { EntityManager } from 'typeorm';

/**
 * Moliyaviy balansni hisoblash:
 * currentSituation = main.balance + courierTotal - marketTotal
 */
export async function calculateFinancialBalance(
  manager: EntityManager,
): Promise<number> {
  const mainCashbox = await manager.findOne(CashEntity, {
    where: { cashbox_type: Cashbox_type.MAIN },
  });
  const mainBalance = Number(mainCashbox?.balance ?? 0);

  const courierCashboxes = await manager.find(CashEntity, {
    where: { cashbox_type: Cashbox_type.FOR_COURIER },
  });
  let courierTotal = 0;
  for (const c of courierCashboxes) {
    courierTotal += Number(c.balance);
  }

  const marketCashboxes = await manager.find(CashEntity, {
    where: { cashbox_type: Cashbox_type.FOR_MARKET },
  });
  let marketTotal = 0;
  for (const m of marketCashboxes) {
    marketTotal += Number(m.balance);
  }

  return mainBalance + courierTotal - marketTotal;
}
