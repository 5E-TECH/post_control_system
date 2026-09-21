/// <reference types="jest" />
import { QueryRunner } from 'typeorm';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import {
  ExtraCostAction,
  ExtraCostCategory,
  ExtraCostDecisionMode,
  ExtraCostStatus,
  Where_deliver,
} from 'src/common/enums';
import { ExtraCostPolicy } from 'src/api/order/utils/extra-cost-policy.util';
import { ExtraCostProofService } from './extra-cost-proof.service';
import { ExtraCostRequestService } from './extra-cost-request.service';

/**
 * XARAJAT SO'ROVI SERVISI.
 *
 * Bu servis "pul kassaga yozilmasin, majburiyat sifatida saqlansin" degan
 * qarorni amalga oshiradi. Uchta narsa qulflanadi:
 *
 *   1. BAYROQ O'CHIQ MARKETDA HECH NARSA YOZILMAYDI — bugungi 100% market
 *      shu holatda. Hot-path'ga bitta ham qo'shimcha INSERT tushmasligi kerak.
 *
 *   2. HOLAT TO'G'RI TANLANADI — `pending` (isbot bor) / `awaiting_proof`
 *      (isbotsiz davom etildi) / `approved` (darhol yozildi).
 *
 *   3. ROLLBACK ILGAKLARI — `void` faqat OCHIQ so'rovlarga, `markReversed`
 *      faqat TASDIQLANGANLARGA tegadi. Aralashib ketsa pul yo'qoladi yoki
 *      ikki marta qaytariladi.
 */

// ── Soxta QueryRunner ───────────────────────────────────────────────────────
function makeQr() {
  const saved: ExtraCostRequestEntity[] = [];
  const updates: Array<{ entity: string; where: unknown; set: unknown }> = [];
  const executed: Array<{ set: Record<string, unknown>; where: string[] }> = [];

  const manager = {
    create: (_e: unknown, d: Record<string, unknown>) =>
      ({ id: 'ecr-1', ...d }) as unknown as ExtraCostRequestEntity,
    save: jest.fn((_e: unknown, row: ExtraCostRequestEntity) => {
      saved.push(row);
      return Promise.resolve(row);
    }),
    update: jest.fn((entity: any, where: unknown, set: unknown) => {
      updates.push({ entity: entity?.name ?? String(entity), where, set });
      return Promise.resolve({ affected: 1 });
    }),
    count: jest.fn(() => Promise.resolve(0)),
    query: jest.fn(() =>
      Promise.resolve([
        { district_name: 'Chilonzor', region_name: 'Toshkent' },
      ]),
    ),
    findOne: jest.fn((_entity: unknown, opts: { select?: unknown }) => {
      // `loadContext` mijozni `select` bilan so'raydi (parol hashi tortilmasin);
      // `attachProof` esa so'rovning o'zini `select`siz so'raydi.
      if (opts?.select) {
        return Promise.resolve({
          id: 'cust-1',
          name: 'Mijoz',
          phone_number: '+998901112233',
        });
      }
      return Promise.resolve({
        id: 'ecr-1',
        proof_ids: [],
      } as unknown as ExtraCostRequestEntity);
    }),
    createQueryBuilder: jest.fn(() => {
      const state: { set: Record<string, unknown>; where: string[] } = {
        set: {},
        where: [],
      };
      const qb: any = {
        update: () => qb,
        set: (v: Record<string, unknown>) => {
          state.set = v;
          return qb;
        },
        where: (w: string) => {
          state.where.push(w);
          return qb;
        },
        andWhere: (w: string) => {
          state.where.push(w);
          return qb;
        },
        execute: () => {
          executed.push(state);
          return Promise.resolve({ affected: 2 });
        },
      };
      return qb;
    }),
  };

  return {
    qr: { manager } as unknown as QueryRunner,
    saved,
    updates,
    executed,
  };
}

const proofServiceStub = {
  validateOwnedUnbound: jest.fn((ids: string[]) =>
    Promise.resolve(ids.map((id) => ({ id })) as ExtraCostProofEntity[]),
  ),
} as unknown as ExtraCostProofService;

/** Telegram xabari — test doirasidan tashqarida, soxta qilinadi. */
const botNotifyStub = {
  notifyMarketUsers: jest.fn(() => Promise.resolve()),
} as unknown as import('../bots/order_create-bot/bot-notify.service').BotNotifyService;

/**
 * Telegram (isbot + tugmalar) — test doirasidan tashqarida.
 *
 * `sendRequest` `false` qaytaradi: "market botga ulanmagan" holati. Shunda
 * servis ESKI MATNLI xabarga qaytadi va mavjud testlar aynan shu yo'lni
 * tekshiradi.
 */
const telegramStub = {
  sendRequest: jest.fn(() => Promise.resolve(false)),
  notifyCourier: jest.fn(() => Promise.resolve()),
} as unknown as import('./extra-cost-telegram.service').ExtraCostTelegramService;

const svc = () =>
  new ExtraCostRequestService(proofServiceStub, botNotifyStub, telegramStub);

const POLICY_DEFERRED: ExtraCostPolicy = {
  mode: 'deferred',
  requireProof: true,
  decisionMode: null,
  reason: 'test',
};
const POLICY_IMMEDIATE: ExtraCostPolicy = {
  mode: 'immediate',
  requireProof: false,
  decisionMode: ExtraCostDecisionMode.AUTO_RULE,
  reason: 'test',
};

const order = () =>
  ({
    id: 'order-1',
    post_id: 'post-1',
    user_id: 'market-1',
    order_number: 100042,
    total_price: 500000,
    where_deliver: Where_deliver.CENTER,
    district_id: 'dist-1',
    customer_id: 'cust-1',
  }) as OrderEntity;

const marketOn = () =>
  ({
    id: 'market-1',
    name: 'Market 8810',
    extra_cost_proof_required: true,
  }) as UserEntity;
const marketOff = () =>
  ({ id: 'market-1', extra_cost_proof_required: false }) as UserEntity;
const courier = () => ({ id: 'courier-1', name: 'Abdurahmon' }) as UserEntity;

const baseRecord = (over: Record<string, any> = {}) => ({
  order: order(),
  market: marketOn(),
  courier: courier(),
  policy: POLICY_DEFERRED,
  amount: 15000,
  actionType: ExtraCostAction.SELL,
  limitMax: 20000,
  courierTariff: 25000,
  input: { extra_cost_category: ExtraCostCategory.TAXI },
  proofs: [{ id: 'p1' }] as ExtraCostProofEntity[],
  historyIds: null,
  ...over,
});

describe("So'rov yozuvi — bayroq O'CHIQ marketlar", () => {
  it('TC1: hech narsa yozilmaydi (bugungi 100% market)', async () => {
    const { qr, saved } = makeQr();
    const res = await svc().record(qr, baseRecord({ market: marketOff() }));
    expect(res).toBeNull();
    expect(saved).toHaveLength(0);
  });

  it('TC2: market `null` bo‘lsa ham yiqilmaydi', async () => {
    const { qr, saved } = makeQr();
    await expect(
      svc().record(qr, baseRecord({ market: null })),
    ).resolves.toBeNull();
    expect(saved).toHaveLength(0);
  });

  it('TC3: summa 0 bo‘lsa yozilmaydi', async () => {
    const { qr, saved } = makeQr();
    await expect(
      svc().record(qr, baseRecord({ amount: 0 })),
    ).resolves.toBeNull();
    expect(saved).toHaveLength(0);
  });
});

describe("So'rov yozuvi — holat tanlash", () => {
  it('TC4: isbot BOR → `pending`, pul langarlari BO‘SH', async () => {
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord());
    expect(saved[0].status).toBe(ExtraCostStatus.PENDING);
    expect(saved[0].settled_at).toBeNull();
    expect(saved[0].market_history_id).toBeNull();
    expect(saved[0].courier_history_id).toBeNull();
    expect(saved[0].decision_mode).toBeNull();
  });

  it('TC5: isbot YO‘Q (isbotsiz davom etildi) → `awaiting_proof`', async () => {
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord({ proofs: [] }));
    expect(saved[0].status).toBe(ExtraCostStatus.AWAITING_PROOF);
  });

  it('TC6: `immediate` → `approved` + langarlar saqlanadi', async () => {
    const { qr, saved } = makeQr();
    await svc().record(
      qr,
      baseRecord({
        policy: POLICY_IMMEDIATE,
        historyIds: { marketHistoryId: 'h-m', courierHistoryId: 'h-c' },
      }),
    );
    expect(saved[0].status).toBe(ExtraCostStatus.APPROVED);
    expect(saved[0].market_history_id).toBe('h-m');
    expect(saved[0].courier_history_id).toBe('h-c');
    expect(saved[0].settled_at).toBeTruthy();
    expect(saved[0].decision_mode).toBe(ExtraCostDecisionMode.AUTO_RULE);
  });
});

describe("So'rov yozuvi — snapshot maydonlari", () => {
  it('TC7: market ID buyurtmadan emas, MARKET obyektidan SNAPSHOT olinadi', async () => {
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord());
    expect(saved[0].market_id).toBe('market-1');
  });

  it('TC8: buyurtma raqami DENORMALIZATSIYA qilinadi (IDOR oldini olish)', async () => {
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord());
    expect(saved[0].order_number).toBe(100042);
    expect(saved[0].order_total_price).toBe(500000);
    expect(saved[0].where_deliver).toBe(Where_deliver.CENTER);
    expect(saved[0].district_name).toBe('Chilonzor');
    expect(saved[0].region_name).toBe('Toshkent');
  });

  it('TC9: chegara SNAPSHOT olinadi — tarif keyin o‘zgarsa tasdiq buzilmasin', async () => {
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord());
    expect(saved[0].limit_max).toBe(20000);
    expect(saved[0].courier_tariff_snapshot).toBe(25000);
  });

  it('TC10: kasrli summa BUTUNGA kesiladi', async () => {
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord({ amount: 15000.9 }));
    expect(saved[0].amount).toBe(15000);
  });

  it('TC11: kategoriya berilmasa `other`', async () => {
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord({ input: {} }));
    expect(saved[0].category).toBe(ExtraCostCategory.OTHER);
  });

  it('TC12: isbotlar AYNI tranzaksiyada bog‘lanadi', async () => {
    const { qr, updates } = makeQr();
    await svc().record(qr, baseRecord());
    expect(updates).toHaveLength(1);
    expect((updates[0].set as any).request_id).toBe('ecr-1');
    expect((updates[0].set as any).bound_at).toBeTruthy();
  });

  it('TC13: isbot yo‘q bo‘lsa bog‘lash so‘rovi ham yuborilmaydi', async () => {
    const { qr, updates } = makeQr();
    await svc().record(qr, baseRecord({ proofs: [] }));
    expect(updates).toHaveLength(0);
  });
});

describe('Isbot talabi — assertProofRequirement', () => {
  it('TC14: isbot MAJBURIY, yuborilmagan → aniq o‘zbekcha xato', async () => {
    await expect(
      svc().assertProofRequirement(POLICY_DEFERRED, {}, 'courier-1'),
    ).rejects.toThrow(/foto isbot biriktirish shart/);
  });

  it('TC15: «isbotsiz davom etish» → SOTUV YIQILMAYDI', async () => {
    await expect(
      svc().assertProofRequirement(
        POLICY_DEFERRED,
        { extra_cost_proof_deferred: true },
        'courier-1',
      ),
    ).resolves.toEqual([]);
  });

  it('TC16: KATEGORIYA yo‘q bo‘lsa ham O‘TADI (sabab majburiy emas)', async () => {
    // Sabab tanlash ataylab olib tashlandi: amalda hamma "Boshqa"ni tanlab,
    // maydon hech qanday ma'lumot bermay faqat sotuvni sekinlashtirardi.
    // Bu test regressiya qo'riqchisi — kimdir majburiylikni qaytarsa yiqiladi.
    await expect(
      svc().assertProofRequirement(
        POLICY_DEFERRED,
        { extra_cost_proof_ids: ['p1'] },
        'courier-1',
      ),
    ).resolves.toBeDefined();
  });

  it('TC17: isbot talab qilinmasa ham, yuborilgani TEKSHIRILADI', async () => {
    // Begona faylni o'zlashtirib olishga urinish shu yerda to'siladi.
    await svc().assertProofRequirement(
      POLICY_IMMEDIATE,
      { extra_cost_proof_ids: ['p9'] },
      'courier-1',
    );
    expect(proofServiceStub.validateOwnedUnbound).toHaveBeenCalledWith(
      ['p9'],
      'courier-1',
    );
  });

  it('TC18: isbot talab qilinmasa va yuborilmasa — tekshiruv ham yo‘q', async () => {
    (proofServiceStub.validateOwnedUnbound as jest.Mock).mockClear();
    await expect(
      svc().assertProofRequirement(POLICY_IMMEDIATE, {}, 'courier-1'),
    ).resolves.toEqual([]);
    expect(proofServiceStub.validateOwnedUnbound).not.toHaveBeenCalled();
  });
});

describe('Rollback ilgaklari', () => {
  it('TC19: `void` FAQAT ochiq so‘rovlarga tegadi', async () => {
    const { qr, executed } = makeQr();
    await svc().voidOpenRequests(qr, 'order-1', 'sabab');
    const w = executed[0].where.join(' ');
    expect(w).toContain('order_id = :orderId');
    expect(w).toContain('status IN (:...open)');
    expect(executed[0].set.status).toBe(ExtraCostStatus.VOID);
    expect(executed[0].set.decision_mode).toBe(
      ExtraCostDecisionMode.SYSTEM_VOID,
    );
    expect(executed[0].set.voided_at).toBeTruthy();
  });

  it('TC20: `markReversed` FAQAT tasdiqlanganlarga tegadi', async () => {
    const { qr, executed } = makeQr();
    await svc().markReversed(qr, 'order-1', 'sabab');
    const w = executed[0].where.join(' ');
    expect(w).toContain('status = :approved');
    expect(executed[0].set.status).toBe(ExtraCostStatus.REVERSED);
  });

  it('TC21: `markReversed` kassa langarlarini TOZALAMAYDI (audit izi qoladi)', async () => {
    // Pul qaytarilgani `cashbox_history` dagi CORRECTION yozuvlaridan
    // ko'rinadi; asl EXTRA_COST langarlari esa nima bo'lganini tushuntiradi.
    const { qr, executed } = makeQr();
    await svc().markReversed(qr, 'order-1', 'sabab');
    expect(executed[0].set).not.toHaveProperty('market_history_id');
    expect(executed[0].set).not.toHaveProperty('courier_history_id');
  });
});

describe('Isbot talabi — «isbotsiz davom etish» CHEGARASI', () => {
  it("TC22: `deferred` rejimida ruxsat — so'rov isbot kutish holatiga o'tadi", async () => {
    await expect(
      svc().assertProofRequirement(
        POLICY_DEFERRED,
        { extra_cost_proof_deferred: true },
        'courier-1',
      ),
    ).resolves.toEqual([]);
  });

  it('TC23: `immediate` + isbot majburiy rejimida RAD ETILADI', async () => {
    // ⚠️ ENG MUHIM QULF. Bu yo'l ochiq bo'lganda (avto-tasdiq chegarasi
    // ostidagi summalar va narx pasaytirish) "isbotsiz davom etaman" katagi
    // isbot talabini BUTUNLAY chetlab o'tardi: pul darhol yozilib, so'rov
    // APPROVED bo'lib yopilardi va "keyin biriktiraman" va'dasi hech qachon
    // bajarilmasdi.
    const immediateButNeedsProof = {
      mode: 'immediate' as const,
      requireProof: true,
      decisionMode: ExtraCostDecisionMode.AUTO_RULE,
      reason: 'test',
    };
    await expect(
      svc().assertProofRequirement(
        immediateButNeedsProof,
        { extra_cost_proof_deferred: true },
        'courier-1',
      ),
    ).rejects.toThrow(/darhol hisobga olinadi/);
  });
});

describe('Marketga xabar — ikki kanal, aniq tartib', () => {
  /** Matnli zaxira kanal (egasi + operatorlar). */
  const notifyStub = () => {
    const calls: string[] = [];
    const stub = {
      notifyMarketUsers: jest.fn((_m: string, text: string) => {
        calls.push(text);
        return Promise.resolve();
      }),
    } as unknown as import('../bots/order_create-bot/bot-notify.service').BotNotifyService;
    return { stub, calls };
  };

  /** Telegram kanali — `sent` yuborilganini bildiradi. */
  const tgStub = (sent: boolean) => {
    const seen: string[] = [];
    const stub = {
      sendRequest: jest.fn((r: ExtraCostRequestEntity) => {
        seen.push(r.id);
        return Promise.resolve(sent);
      }),
      notifyCourier: jest.fn(() => Promise.resolve()),
    } as unknown as import('./extra-cost-telegram.service').ExtraCostTelegramService;
    return { stub, seen };
  };

  /**
   * Xabar yuborish `await`SIZ (fire-and-forget) — sotuvni ushlab turmasligi
   * kerak. Shuning uchun tekshirishdan oldin mikrotasklar bo'shatiladi.
   */
  const flush = () => new Promise((r) => setImmediate(r));

  const req = (status: ExtraCostStatus) =>
    ({
      id: 'r1',
      market_id: 'm1',
      order_number: 100042,
      amount: 15000,
      status,
    }) as ExtraCostRequestEntity;

  it('TC24: PENDING — Telegramga (isbot + tugmalar) yuboriladi', async () => {
    const tg = tgStub(true);
    const { stub, calls } = notifyStub();
    new ExtraCostRequestService(
      proofServiceStub,
      stub,
      tg.stub,
    ).notifyMarketAboutRequest(req(ExtraCostStatus.PENDING));
    await flush();
    expect(tg.seen).toEqual(['r1']);
    // ⚠️ Tugmali xabar yetgan bo'lsa matnli xabar TAKROR bo'lardi.
    expect(calls).toHaveLength(0);
  });

  it('TC24b: market botga ulanmagan → MATNLI xabarga qaytadi', async () => {
    // Bugungi holat: 12 marketdan hech birida `telegram_id` yo'q. Zaxira
    // kanalsiz ular umuman xabar olmasdi.
    const tg = tgStub(false);
    const { stub, calls } = notifyStub();
    new ExtraCostRequestService(
      proofServiceStub,
      stub,
      tg.stub,
    ).notifyMarketAboutRequest(req(ExtraCostStatus.PENDING));
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('100042');
  });

  it('TC25: AWAITING_PROOF — hech qaysi kanalga YUBORILMAYDI', async () => {
    // Market panelida bu so'rov KO'RINMAYDI (isboti yo'q). "Panelga kiring,
    // tasdiqlang" deb xabar yuborish uni bo'sh sahifaga olib borardi —
    // foydalanuvchi sinovda aynan shuni ko'rgan.
    const tg = tgStub(true);
    const { stub, calls } = notifyStub();
    new ExtraCostRequestService(
      proofServiceStub,
      stub,
      tg.stub,
    ).notifyMarketAboutRequest(req(ExtraCostStatus.AWAITING_PROOF));
    await flush();
    expect(calls).toHaveLength(0);
    expect(tg.seen).toHaveLength(0);
  });

  it('TC26: APPROVED/REJECTED — xabar YUBORILMAYDI', async () => {
    const tg = tgStub(true);
    const { stub, calls } = notifyStub();
    const s = new ExtraCostRequestService(proofServiceStub, stub, tg.stub);
    s.notifyMarketAboutRequest(req(ExtraCostStatus.APPROVED));
    s.notifyMarketAboutRequest(req(ExtraCostStatus.REJECTED));
    await flush();
    expect(calls).toHaveLength(0);
    expect(tg.seen).toHaveLength(0);
  });

  it('TC26b: Telegram xatosi SOTUVNI YIQITMAYDI', async () => {
    const stubTg = {
      sendRequest: jest.fn(() => Promise.reject(new Error('telegram down'))),
    } as unknown as import('./extra-cost-telegram.service').ExtraCostTelegramService;
    const { stub } = notifyStub();
    expect(() =>
      new ExtraCostRequestService(
        proofServiceStub,
        stub,
        stubTg,
      ).notifyMarketAboutRequest(req(ExtraCostStatus.PENDING)),
    ).not.toThrow();
    await flush();
  });
});

describe('Isbot biriktirish — awaiting_proof dan chiqish', () => {
  const withProofs = (ids: string[]) =>
    new ExtraCostRequestService(
      {
        validateOwnedUnbound: jest.fn(() =>
          Promise.resolve(ids.map((id) => ({ id })) as ExtraCostProofEntity[]),
        ),
      } as unknown as ExtraCostProofService,
      botNotifyStub,
      telegramStub,
    );

  it("TC27: bo'sh isbot ro'yxati RAD ETILADI", async () => {
    const { qr } = makeQr();
    await expect(
      withProofs([]).attachProof(qr, {
        requestId: 'r1',
        courierId: 'c1',
        proofIds: [],
      }),
    ).rejects.toThrow(/Kamida bitta isbot/);
  });

  it('TC28: egalik va status SO‘ROV ICHIDA tekshiriladi (atomik darvoza)', async () => {
    const { qr, executed } = makeQr();
    // `makeQr` har doim affected=2 qaytaradi, shuning uchun o'tadi.
    await withProofs(['p1']).attachProof(qr, {
      requestId: 'r1',
      courierId: 'c1',
      proofIds: ['p1'],
    });
    const w = executed[0].where.join(' ');
    expect(w).toContain('courier_id = :cid');
    expect(w).toContain('status = :s');
    expect(executed[0].set.status).toBe(ExtraCostStatus.PENDING);
  });
});

describe("Kontekst maydonlari — qaror uchun ma'lumot", () => {
  it('TC29: mijoz ismi va telefoni SNAPSHOT qilinadi', async () => {
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord());
    expect(saved[0].customer_name).toBe('Mijoz');
    expect(saved[0].customer_phone).toBe('+998901112233');
  });

  it('TC30: viloyat va tuman nomi yoziladi', async () => {
    // Sotuv oqimida buyurtma lock bilan RELATIONSIZ yuklanadi, shuning uchun
    // kontekst servisning O'ZI tomonidan olinadi — aks holda `district_name`
    // har doim null bo'lib qolardi.
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord());
    expect(saved[0].district_name).toBe('Chilonzor');
    expect(saved[0].region_name).toBe('Toshkent');
  });

  it('TC31: market va kuryer NOMI yoziladi (parol hashi tortilmaydi)', async () => {
    // `relations: ['courier','market']` butun `users` qatorini tortardi —
    // ichida `password` hashi bilan. Shuning uchun faqat nom snapshot qilinadi.
    const { qr, saved } = makeQr();
    await svc().record(qr, baseRecord());
    expect(saved[0].market_name).toBe('Market 8810');
    expect(saved[0].courier_name).toBe('Abdurahmon');
    expect(JSON.stringify(saved[0])).not.toContain('password');
  });

  it('TC32: kontekst yuklanmasa ham SOTUV YIQILMAYDI', async () => {
    const { qr, saved } = makeQr();
    // Kontekst so'rovlari xato bersin.
    (qr.manager as any).query = jest.fn(() => Promise.reject(new Error('db')));
    await expect(svc().record(qr, baseRecord())).resolves.toBeTruthy();
    expect(saved[0].district_name).toBeNull();
  });
});

describe('Dublikat isbot sanog‘i — market ko‘radigan qizil signal', () => {
  /**
   * ⚠️ Bu ustun AVVAL DOIM 0 edi: dublikat soni faqat yuklash javobida
   * qaytarilardi (kuryerga) va hech qayerda saqlanmasdi. Ya'ni market bir
   * taksi cheki 5 buyurtmaga yozilganini HECH QACHON ko'rmasdi.
   */
  const withDup = (dup: number) => {
    const made = makeQr();
    const orig = (made.qr.manager as any).query;
    (made.qr.manager as any).query = jest.fn((sql: string, params: any[]) => {
      if (String(sql).includes('extra_cost_proof')) {
        return Promise.resolve([{ dup }]);
      }
      return orig(sql, params);
    });
    return made;
  };

  const proofsWithSha = [
    { id: 'p1', sha256: 'aaa' },
  ] as unknown as ExtraCostProofEntity[];

  it('TC33: takroriy isbot → `dup_proof_count` YOZILADI', async () => {
    const { qr, saved, updates } = withDup(3);
    await svc().record(qr, baseRecord({ proofs: proofsWithSha }));
    expect(saved[0].dup_proof_count).toBe(3);
    // Yozuv saqlangandan KEYIN yangilanadi (bog'lash o'shanda tugaydi).
    expect(
      updates.some(
        (u) => (u.set as any)?.dup_proof_count === 3,
      ),
    ).toBe(true);
  });

  it('TC34: yagona ishlatilgan isbot → ustun tegilmaydi', async () => {
    const { qr, saved } = withDup(1);
    await svc().record(qr, baseRecord({ proofs: proofsWithSha }));
    expect(saved[0].dup_proof_count).toBe(0);
  });

  it('TC35: sanash yiqilsa ham SOTUV YIQILMAYDI', async () => {
    // Bu faqat ko'rsatkich — uning xatosi pul oqimini to'xtatmasligi kerak.
    const made = makeQr();
    (made.qr.manager as any).query = jest.fn((sql: string) =>
      String(sql).includes('extra_cost_proof')
        ? Promise.reject(new Error('db'))
        : Promise.resolve([
            { district_name: 'Chilonzor', region_name: 'Toshkent' },
          ]),
    );
    await expect(
      svc().record(made.qr, baseRecord({ proofs: proofsWithSha })),
    ).resolves.toBeTruthy();
  });

  it('TC36: sha256 yo‘q bo‘lsa so‘rov umuman yuborilmaydi', async () => {
    const { qr } = makeQr();
    const spy = jest.spyOn(qr.manager, 'query');
    await svc().record(qr, baseRecord());
    const dupCalls = spy.mock.calls.filter((c) =>
      String(c[0]).includes('extra_cost_proof'),
    );
    expect(dupCalls).toHaveLength(0);
  });
});
