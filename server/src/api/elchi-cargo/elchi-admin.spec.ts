/// <reference types="jest" />
import { ElchiAdminService } from './elchi-admin.service';

/**
 * P5a — admin paneli servisi.
 *
 * Qulflanadigan invariantlar:
 *   - **qarz davr bo'yicha kesilmaydi** — u butun vaqt qoldig'i;
 *   - imzosi noto'g'ri webhookni qayta ishlash **RAD ETILADI**;
 *   - allaqachon muvaffaqiyatli webhook qayta ishlanmaydi (ikki marta qo'llash yo'q);
 *   - kelajak sanali to'lov RAD ETILADI (qarzni yolg'on kamaytirardi);
 *   - manfiy/nol summa RAD ETILADI;
 *   - "o'chirish" **ma'lumotni o'chirmaydi**, faqat bayroqlarni tushiradi;
 *   - nomuvofiqlikni yopish PULGA TEGMAYDI.
 */

type Row = Record<string, any>;

function buildSvc(
  over: {
    shipments?: Row[];
    webhookLogs?: Row[];
    payments?: Row[];
    /** `sumMoney` uchun xom natijalar: [sent, collected, paid] */
    rawSums?: [number, number, number];
    /** Elchi ushlagan tarif yig'indisi (audit M2). */
    rawFee?: number;
    /** Yangi pul maydonlari yo'q posilkalar soni. */
    rawUnreported?: number;
    /** To'liq nazorat kerak bo'lganda — xom javoblar ketma-ketligi. */
    rawQueue?: Array<Record<string, string>>;
    applyImpl?: jest.Mock;
    config?: Row;
  } = {},
) {
  const svc: any = Object.create(ElchiAdminService.prototype);
  const saved: Row[] = [];
  const deleted: Row[] = [];
  const logs: Row[] = [];

  const sums = over.rawSums ?? [0, 0, 0];
  let rawCall = 0;
  /**
   * `rawSums` = [jo'natilgan, yig'ilgan, to'langan] — eski qulay shakl
   * saqlanadi. Tarif `rawFee` bilan beriladi (sukut: 0), chunki qarz endi
   * `yig'ilgan − tarif − to'langan` (audit M2).
   */
  const rawQueue: Array<Record<string, string>> = over.rawQueue ?? [
    { sum: String(sums[0] ?? 0), cnt: '0' },
    {
      collected: String(sums[1] ?? 0),
      fee: String(over.rawFee ?? 0),
      cnt: '0',
    },
    { sum: String(sums[2] ?? 0), cnt: '0' },
    { cnt: String(over.rawUnreported ?? 0) },
  ];

  const makeQb = (): any => {
    const qb: any = {
      select: jest.fn(() => qb),
      addSelect: jest.fn(() => qb),
      leftJoin: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getCount: jest.fn(() => Promise.resolve(0)),
      getManyAndCount: jest.fn(() =>
        Promise.resolve([over.shipments ?? [], (over.shipments ?? []).length]),
      ),
      /**
       * ⚠️ ANIQ KETMA-KETLIK, aylanma EMAS.
       *
       * Ilgari mock uch qiymatni `% 3` bilan aylantirardi va har bir
       * so'rovga `{sum, cnt}` qaytarardi. So'rovlar soni yoki javob shakli
       * o'zgarsa test JIMGINA boshqa narsani tekshirib qolardi. `sumMoney`
       * endi TO'RT so'rov qiladi va ikkinchisi `{collected, fee}` shaklida.
       *
       * Tartib (sumMoney ichida): sent -> reported{collected,fee} -> paid
       * -> unreported{cnt}.
       */
      getRawOne: jest.fn(() => Promise.resolve(rawQueue[rawCall++] ?? {})),
    };
    return qb;
  };

  svc.configRepo = {
    save: jest.fn((x: Row) => {
      saved.push(x);
      return Promise.resolve(x);
    }),
  };
  svc.shipmentRepo = {
    count: jest.fn(() => Promise.resolve((over.shipments ?? []).length)),
    createQueryBuilder: jest.fn(() => makeQb()),
    findOne: jest.fn(() => Promise.resolve(over.shipments?.[0] ?? null)),
    save: jest.fn((x: Row) => {
      saved.push(x);
      return Promise.resolve(x);
    }),
  };
  svc.webhookLogRepo = {
    count: jest.fn(() => Promise.resolve(0)),
    findOne: jest.fn(() => Promise.resolve(over.webhookLogs?.[0] ?? null)),
    createQueryBuilder: jest.fn(() => makeQb()),
    save: jest.fn((x: Row) => {
      saved.push(x);
      return Promise.resolve(x);
    }),
  };
  svc.paymentRepo = {
    createQueryBuilder: jest.fn(() => makeQb()),
    find: jest.fn(() => Promise.resolve(over.payments ?? [])),
    findOne: jest.fn(() => Promise.resolve(over.payments?.[0] ?? null)),
    create: jest.fn((x: Row) => ({ id: 'pay-1', created_at: 1, ...x })),
    save: jest.fn((x: Row) => {
      saved.push(x);
      return Promise.resolve(x);
    }),
    delete: jest.fn((where: Row) => {
      deleted.push(where);
      return Promise.resolve({ affected: 1 });
    }),
  };
  svc.configService = {
    getOrCreate: jest.fn(() =>
      Promise.resolve(
        over.config ?? {
          id: 'cfg',
          is_active: true,
          webhook_enabled: true,
          reconcile_enabled: true,
        },
      ),
    ),
    getReadiness: jest.fn(() => Promise.resolve({ ready: true, checks: [] })),
  };
  svc.webhookService = {
    applyStatusUpdate:
      over.applyImpl ??
      jest.fn(() =>
        Promise.resolve({ status: 'success', message: "qo'llandi" }),
      ),
  };
  svc.activityLog = {
    log: jest.fn((p: Row) => {
      logs.push(p);
      return Promise.resolve();
    }),
  };
  svc.logger = { warn: jest.fn(), log: jest.fn() };

  return { svc, saved, deleted, logs };
}

describe('ElchiAdminService — hisob-kitob (pul)', () => {
  it("⭐ qarz = yig'ilgan − Elchi tarifi − to'langan (audit M2)", async () => {
    /**
     * ⚠️ FORMULA O'ZGARDI VA BU TUZATISH.
     *
     * Ilgari `qarz = yig'ilgan − to'langan` edi va "yig'ilgan" deb
     * `cod_collected_reported` olinardi — u Elchi'ning `order.paid_amount`
     * qiymati, ya'ni market qarzining avto-to'langan qismi, oddiy sotuvda 0.
     * Natijada qarz MANFIY chiqardi.
     *
     * Endi Elchi yig'gan naqdni va o'z tarifini ALOHIDA aytadi. Elchi
     * tarifni o'zida qoldiradi, qolganini bizga beradi — shuning uchun
     * tarif ham ayiriladi.
     */
    const { svc } = buildSvc({
      rawSums: [1_000_000, 900_000, 400_000],
      rawFee: 30_000,
    });
    const money = await svc.sumMoney();
    expect(money.cod_sent).toBe(1_000_000);
    expect(money.cod_collected).toBe(900_000);
    expect(money.elchi_fee).toBe(30_000);
    expect(money.paid_by_elchi).toBe(400_000);
    // 900 000 yig'ildi − 30 000 tarif − 400 000 to'langan = 470 000
    expect(money.debt).toBe(470_000);
  });

  it("⭐ qarz MANFIY chiqmaydi — eski xatoning regressiya qo'riqchisi", async () => {
    /**
     * Eski formulada yig'ilgan 0 edi (chunki maydon yolg'on), to'lovlar esa
     * bor — natijada qarz MANFIY ko'rinardi va operator "Elchi bizga qarz
     * emas, biz unga qarzmiz" deb o'qirdi. Hozir yig'ilgan 0 bo'lishi FAQAT
     * haqiqatan hech narsa yig'ilmaganda (masalan hammasi onlayn to'langan)
     * yuz beradi.
     */
    const { svc } = buildSvc({ rawSums: [500_000, 0, 0], rawFee: 15_000 });
    const money = await svc.sumMoney();
    // Onlayn to'langan: naqd yig'ilmagan, tarifni market bizga QARZ.
    expect(money.debt).toBe(-15_000);
    expect(money.cod_collected).toBe(0);
  });

  it("⭐ ma'lumot yo'q posilkalar ALOHIDA sanaladi, aralashtirilmaydi", async () => {
    /**
     * Eski posilkalarda yangi maydonlar `NULL`. `COALESCE` bilan eski
     * yolg'on qiymatga qaytish rost bilan yolg'onni bitta yig'indiga
     * qo'shardi. Shu bois ular yig'indiga KIRMAYDI va soni ochiq
     * ko'rsatiladi — panel "N posilka bo'yicha ma'lumot yo'q" deb aytadi.
     */
    const { svc } = buildSvc({
      rawSums: [1_000_000, 200_000, 0],
      rawFee: 6_000,
      rawUnreported: 9,
    });
    const money = await svc.sumMoney();
    expect(money.unreported_count).toBe(9);
    // Yig'indi faqat MA'LUMOTI BOR posilkalar bo'yicha.
    expect(money.cod_collected).toBe(200_000);
  });

  it("qarz DAVR bo'yicha kesilmaydi — `overall` bloki alohida keladi", async () => {
    const { svc } = buildSvc({ rawSums: [10, 20, 30] });
    const res = await svc.getSettlement({ from: 1_000, to: 2_000 });

    // `period` va `overall` — ikki BOSHQA blok. Qarz faqat `overall`da.
    expect(res.period).toBeDefined();
    expect(res.overall).toBeDefined();
    expect(res.period).not.toHaveProperty('debt');
    expect(res.overall).toHaveProperty('debt');
    expect(res.period.from).toBe(1_000);
    expect(res.period.to).toBe(2_000);
  });

  it("⭐ Elchi ushlagan summa TAXMIN qilinmaydi — Elchi o'zi aytadi (M2)", async () => {
    /**
     * ⚠️ BU TEST AVVAL XATO FORMULANI QULFLAB TURGAN.
     *
     * Ilgari tarif `sent_for_collected − sum` deb hisoblanardi. "sum"
     * (yig'ilgan) esa amalda 0 bo'lgani uchun tarif o'rniga BUTUN COD
     * chiqardi — 15 000 emas, 500 000. Test yashil edi, chunki fixture
     * `sum: 900000` degan haqiqatda hech qachon bo'lmaydigan qiymat berardi.
     *
     * Endi Elchi tarifning sotuvda ISHLATILGAN snapshotini yuboradi va
     * panel uni shundayligicha yig'adi — ayirma bilan taxmin qilmaydi.
     */
    const { svc } = buildSvc();
    svc.shipmentRepo.createQueryBuilder = jest.fn(() => {
      const qb: any = {
        select: jest.fn(() => qb),
        addSelect: jest.fn(() => qb),
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        getRawOne: jest.fn(() =>
          Promise.resolve({
            sum: '900000',
            cnt: '3',
            // Elchi aytgan tarif yig'indisi — ayirma bilan hisoblanmaydi.
            fee: '45000',
            sent_for_collected: '1000000',
          }),
        ),
      };
      return qb;
    });

    const res = await svc.getSettlement({ from: 1, to: 2 });

    // Elchi aytgan qiymat — 3 posilka x 15 000 tarif.
    expect(res.period.elchi_fee).toBe(45_000);
    expect(res.period.collected_count).toBe(3);
    /**
     * Eski (xato) formula 1 000 000 − 900 000 = 100 000 berardi. Endi u
     * ishlatilmaydi — regressiya qo'riqchisi.
     */
    expect(res.period.elchi_fee).not.toBe(100_000);
  });

  it('teskari oraliq (from > to) RAD ETILADI', async () => {
    const { svc } = buildSvc();
    await expect(svc.getSettlement({ from: 5_000, to: 1_000 })).rejects.toThrow(
      /katta/i,
    );
  });
});

describe("ElchiAdminService — qo'lda to'lov (M6)", () => {
  it("to'lovni qayd etadi va audit yozadi", async () => {
    const { svc, logs } = buildSvc();
    const res = await svc.addSettlementPayment(
      { amount: 250_000, note: "  o'tkazma #12  " },
      { id: 'u1' },
    );
    expect(res.amount).toBe('250000.00');
    expect(res.note).toBe("o'tkazma #12"); // trim qilingan
    expect(res.created_by).toBe('u1');
    expect(logs[0].action).toBe('elchi_payment_recorded');
  });

  it('nol yoki manfiy summa RAD ETILADI', async () => {
    const { svc } = buildSvc();
    await expect(svc.addSettlementPayment({ amount: 0 })).rejects.toThrow(
      /musbat/i,
    );
    await expect(svc.addSettlementPayment({ amount: -5 })).rejects.toThrow(
      /musbat/i,
    );
  });

  it("son bo'lmagan summa RAD ETILADI", async () => {
    const { svc } = buildSvc();
    await expect(
      svc.addSettlementPayment({ amount: "ko'p" as any }),
    ).rejects.toThrow(/musbat/i);
  });

  it("KELAJAK sanali to'lov RAD ETILADI — qarzni yolg'on kamaytirardi", async () => {
    const { svc } = buildSvc();
    await expect(
      svc.addSettlementPayment({
        amount: 100,
        paid_at: Date.now() + 10 * 60 * 1000,
      }),
    ).rejects.toThrow(/kelajakda/i);
  });

  it("o'tgan sanali to'lov QABUL QILINADI (kechagi pul bugun kiritiladi)", async () => {
    const { svc } = buildSvc();
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    const res = await svc.addSettlementPayment({
      amount: 100,
      paid_at: yesterday,
    });
    expect(res.paid_at).toBe(yesterday);
  });

  it("o'chirishda eski qiymat auditga yoziladi", async () => {
    const { svc, deleted, logs } = buildSvc({
      payments: [{ id: 'p1', amount: '500.00', paid_at: 111, note: 'x' }],
    });
    await svc.deleteSettlementPayment('p1', { id: 'u1' });
    expect(deleted[0]).toEqual({ id: 'p1' });
    expect(logs[0].action).toBe('elchi_payment_deleted');
    expect(logs[0].old_value.amount).toBe(500);
  });

  it("mavjud bo'lmagan to'lovni o'chirish 404 beradi", async () => {
    const { svc } = buildSvc({ payments: [] });
    await expect(svc.deleteSettlementPayment("yo'q")).rejects.toThrow(
      /topilmadi/i,
    );
  });
});

describe('ElchiAdminService — webhookni qayta ishlash', () => {
  it("imzosi NOTO'G'RI yozuv RAD ETILADI", async () => {
    const { svc } = buildSvc({
      webhookLogs: [
        { event_id: 'e1', signature_valid: false, status: 'invalid_signature' },
      ],
    });
    await expect(svc.reprocessWebhook('e1')).rejects.toThrow(/imzo/i);
  });

  it("allaqachon muvaffaqiyatli hodisa QAYTA QO'LLANMAYDI", async () => {
    const apply = jest.fn();
    const { svc } = buildSvc({
      webhookLogs: [
        { event_id: 'e1', signature_valid: true, status: 'success' },
      ],
      applyImpl: apply,
    });
    const res = await svc.reprocessWebhook('e1');
    expect(res.success).toBe(true);
    expect(apply).not.toHaveBeenCalled(); // eng muhimi
  });

  it('muvaffaqiyatsiz yozuv qayta ishlanadi va status yangilanadi', async () => {
    const log: Row = {
      event_id: 'e1',
      signature_valid: true,
      status: 'failed',
      raw_payload: { external_order_id: 'o1', status: 'sold' },
    };
    const { svc, saved, logs } = buildSvc({
      webhookLogs: [log],
      applyImpl: jest.fn(() =>
        Promise.resolve({ status: 'success', message: 'ok' }),
      ),
    });
    const res = await svc.reprocessWebhook('e1', { id: 'u1' });
    expect(res.status).toBe('success');
    expect(saved[0].status).toBe('success');
    expect(saved[0].processed_at).toBeGreaterThan(0);
    expect(logs[0].action).toBe('elchi_webhook_reprocessed');
  });

  it("qo'llashda xato bo'lsa log `failed` bo'lib SAQLANADI va xato qayta otiladi", async () => {
    const log: Row = {
      event_id: 'e1',
      signature_valid: true,
      status: 'failed',
      raw_payload: {},
    };
    const { svc, saved } = buildSvc({
      webhookLogs: [log],
      applyImpl: jest.fn(() => Promise.reject(new Error('DB yiqildi'))),
    });
    await expect(svc.reprocessWebhook('e1')).rejects.toThrow('DB yiqildi');
    expect(saved[0].status).toBe('failed');
    expect(saved[0].error_message).toContain('DB yiqildi');
  });

  it('topilmagan log 404 beradi', async () => {
    const { svc } = buildSvc({ webhookLogs: [] });
    await expect(svc.reprocessWebhook("yo'q")).rejects.toThrow(/topilmadi/i);
  });
});

describe('ElchiAdminService — nomuvofiqlik', () => {
  it('belgini tozalaydi va PULGA TEGMAYDI', async () => {
    const shipment: Row = {
      order_id: 'o1',
      mismatch_at: 123,
      mismatch_reason: 'summa farq qiladi',
      cod_amount_sent: '250000.00',
      cod_collected_reported: '240000.00',
      order: { order_number: 42 },
    };
    const { svc, saved, logs } = buildSvc({ shipments: [shipment] });

    await svc.resolveMismatch('o1', { id: 'u1' });

    expect(saved[0].mismatch_at).toBeNull();
    expect(saved[0].mismatch_reason).toBeNull();
    // Pul maydonlari O'ZGARMAYDI — bu tugma faqat "ko'rildi" degani.
    expect(saved[0].cod_amount_sent).toBe('250000.00');
    expect(saved[0].cod_collected_reported).toBe('240000.00');
    expect(logs[0].new_value.previous_reason).toBe('summa farq qiladi');
  });

  it("belgisi yo'q posilkada jimgina muvaffaqiyat qaytaradi", async () => {
    const { svc, saved } = buildSvc({
      shipments: [{ order_id: 'o1', mismatch_at: null }],
    });
    const res = await svc.resolveMismatch('o1');
    expect(res.success).toBe(true);
    expect(saved).toHaveLength(0); // ortiqcha yozuv yo'q
  });
});

describe("ElchiAdminService — integratsiyani to'xtatish", () => {
  it("barcha bayroqlarni tushiradi, MA'LUMOTNI o'chirmaydi", async () => {
    const config: Row = {
      id: 'cfg',
      is_active: true,
      webhook_enabled: true,
      reconcile_enabled: true,
      api_key: 'maxfiy',
      elchi_market_id: 'm1',
    };
    const { svc, saved, logs } = buildSvc({ config });

    await svc.shutdown({ id: 'u1' });

    expect(saved[0].is_active).toBe(false);
    expect(saved[0].webhook_enabled).toBe(false);
    expect(saved[0].reconcile_enabled).toBe(false);
    // Bog'lanishlar SAQLANADI — aks holda qayta yoqishda hammasi qaytadan
    // sozlanishi kerak bo'lardi va eski buyurtmalar tarixi uzilardi.
    expect(saved[0].api_key).toBe('maxfiy');
    expect(saved[0].elchi_market_id).toBe('m1');
    expect(logs[0].action).toBe('elchi_shutdown');
  });
});
