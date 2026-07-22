/**
 * AI-balans servisini jonli DB'da test qilish.
 *   npx ts-node -r tsconfig-paths/register scripts/test-ai-balance.ts
 */
import AppDataSource from '../src/data-source';
import { UserEntity } from '../src/core/entity/users.entity';
import { AiTransactionEntity } from '../src/core/entity/ai-transaction.entity';
import { MyLogger } from '../src/logger/logger.service';
import { AiBalanceService } from '../src/api/ai-balance/ai-balance.service';
import { Roles } from '../src/common/enums';

async function main() {
  await AppDataSource.initialize();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new AiBalanceService(
    AppDataSource.getRepository(UserEntity),
    AppDataSource.getRepository(AiTransactionEntity),
    AppDataSource,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new MyLogger(null as any),
  );

  const market = await AppDataSource.getRepository(UserEntity).findOne({
    where: { name: '8810', role: Roles.MARKET },
  });
  const id = market!.id;
  console.log('Market 8810:', id, '\n');

  // Toza boshlash: yoqish, narx 300, balans 0
  await svc.setEnabled(id, true);
  await svc.setPrice(id, 300);
  await AppDataSource.query('UPDATE users SET ai_balance=0 WHERE id=$1', [id]);

  console.log('1) To\'ldirish 3000:');
  await svc.topup(id, 3000, 'test-admin', "Test to'lov");
  console.log('   holat:', await svc.getState(id), '\n');

  console.log('2) 2 marta buyurtma (300 dan):');
  for (let i = 1; i <= 2; i++) {
    const c = await svc.chargeForOrder(id, { actor: 'operator-x' });
    console.log(`   charge #${i}:`, c);
  }
  console.log('');

  console.log('3) Refund 300 (AI xato simulyatsiyasi):');
  await svc.refund(id, 300, { actor: 'system' });
  console.log('   holat:', await svc.getState(id), '\n');

  console.log('4) O\'chirilgan holatda charge:');
  await svc.setEnabled(id, false);
  console.log('   charge:', await svc.chargeForOrder(id));
  await svc.setEnabled(id, true); // qayta yoqamiz
  console.log('');

  console.log('5) Balans yetmaganda charge (narx 5000 qilib):');
  await svc.setPrice(id, 5000);
  console.log('   charge:', await svc.chargeForOrder(id));
  await svc.setPrice(id, 300); // qaytaramiz
  console.log('');

  console.log('6) Tarix:');
  const h = await svc.getHistory(id, 10);
  h.forEach((x) =>
    console.log(`   ${x.type.padEnd(6)} ${x.amount} -> ${x.balance_after}`),
  );

  const final = await svc.getState(id);
  console.log('\n✅ Yakuniy holat (bot testi uchun):', final);
  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
