/**
 * AI buyurtma oqimini Telegramsiz test qilish:
 * jonli Claude API + real DB bilan extractDraft -> resolveDraft -> tasdiq kartasi.
 * Ishga tushirish (server/ ichida):
 *   npx ts-node -r tsconfig-paths/register scripts/test-ai-order.ts
 */
import AppDataSource from '../src/data-source';
import { ProductEntity } from '../src/core/entity/product.entity';
import { DistrictEntity } from '../src/core/entity/district.entity';
import { UserEntity } from '../src/core/entity/users.entity';
import { MyLogger } from '../src/logger/logger.service';
import { ClaudeService } from '../src/infrastructure/ai/claude.service';
import { AiOrderService } from '../src/api/bots/order_create-bot/ai-order.service';
import { Roles } from '../src/common/enums';

async function main() {
  await AppDataSource.initialize();
  console.log('✅ DB ulandi\n');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logger = new MyLogger(null as any);
  const claude = new ClaudeService(logger);
  console.log('AI yoqilganmi (ANTHROPIC_API_KEY bor):', claude.isEnabled(), '\n');

  const ai = new AiOrderService(
    claude,
    AppDataSource.getRepository(ProductEntity),
    AppDataSource.getRepository(DistrictEntity),
    AppDataSource.getRepository(UserEntity),
    // orderService — extract/resolve uchun ishlatilmaydi (faqat commit)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    null as any,
    logger,
  );

  const market = await AppDataSource.getRepository(UserEntity).findOne({
    where: { name: 'market1', role: Roles.MARKET },
  });
  if (!market) {
    console.log("❌ 'market1' topilmadi");
    await AppDataSource.destroy();
    return;
  }
  console.log(`Market: ${market.name} (id=${market.id})\n`);

  const cases = [
    'Dilnoza Karimova, 901234567, Toshkent Chilonzor, 2 dona olma va 1 dona tv, 150 ming, ertaga yetkazing',
    'Aziz, 935556677, Andijon Shaxrixon, 3 ta test, 90 ming',
  ];

  for (const text of cases) {
    console.log('════════════════════════════════════════');
    console.log('KIRISH:', text, '\n');

    const draft = await ai.extractDraft(text);
    if (!draft) {
      console.log('❌ extractDraft null qaytardi (API xatosi?)\n');
      continue;
    }
    console.log('1) EKSTRAKSIYA (nomlar):');
    console.log(
      JSON.stringify(
        {
          customer_name: draft.customer_name,
          phone_number: draft.phone_number,
          region_name: draft.region_name,
          district_name: draft.district_name,
          items: draft.items.map((i) => ({ name: i.name, qty: i.quantity })),
          total_price: draft.total_price,
          comment: draft.comment,
        },
        null,
        2,
      ),
    );

    await ai.resolveDraft(draft, market.id);
    console.log('\n2) REZOLYUTSIYA (DB moslash):');
    console.log(
      '  tuman:',
      draft.district_id
        ? `✅ ${draft.district_label}`
        : `❓ nomzodlar: ${(draft.district_candidates || [])
            .map((c) => c.label)
            .join(' | ') || 'YO‘Q'}`,
    );
    for (const it of draft.items) {
      console.log(
        `  mahsulot "${it.name}":`,
        it.product_id
          ? `✅ ${it.resolved_name}`
          : `❓ nomzodlar: ${(it.candidates || [])
              .map((c) => c.name)
              .join(' | ') || 'YO‘Q'}`,
      );
    }

    const missing = ai.missingRequired(draft);
    const next = ai.firstUnresolved(draft);
    console.log('\n3) HOLAT:');
    if (missing.length) {
      console.log('  ⚠️ Yetishmayapti (WebApp kerak):', missing.join(', '));
    } else if (next) {
      console.log(
        `  ❓ Aniqlashtirish kerak: ${next.type}${
          next.itemIndex != null ? ` (item ${next.itemIndex})` : ''
        }`,
      );
    } else {
      console.log('  ✅ Tayyor — tasdiq kartasi:');
      console.log(
        ai
          .buildConfirmCard(draft)
          .text.split('\n')
          .map((l) => '     ' + l)
          .join('\n'),
      );
    }
    console.log('');
  }

  // ─── Ko'p bosqichli (collecting) simulyatsiya ───
  console.log('════════════════════════════════════════');
  console.log("COLLECTING (ko'p bosqich): yetishmagan maydon so'raladi\n");
  let raw = 'psarinorm 2 ta, andijon asaka, 550 ming, operator opertaor-2';
  console.log('1-xabar:', raw);
  let d = await ai.extractDraft(raw);
  if (d) {
    await ai.resolveDraft(d, market.id);
    console.log(
      '  → yetishmayapti:',
      ai.missingRequired(d).join(', ') || "YO'Q",
    );
  }
  const followUp = '994458745 Malika bozorova';
  raw += '\n' + followUp;
  console.log(`\n2-xabar (qo'shildi): ${followUp}`);
  d = await ai.extractDraft(raw);
  if (d) {
    await ai.resolveDraft(d, market.id);
    const miss = ai.missingRequired(d);
    console.log('  → yetishmayapti:', miss.join(', ') || "YO'Q");
    if (!miss.length && !ai.firstUnresolved(d)) {
      console.log(
        '  ✅ To‘liq! Tasdiq kartasi:\n' +
          ai
            .buildConfirmCard(d)
            .text.split('\n')
            .map((l) => '     ' + l)
            .join('\n'),
      );
    }
  }
  console.log('');

  await AppDataSource.destroy();
  console.log('✅ Test tugadi');
}

main().catch((e) => {
  console.error('❌ Xato:', e);
  process.exit(1);
});
