import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MarketplaceOutboxWorker } from './marketplace-outbox.worker';
import { MarketplaceOutboxStatus } from './marketplace.enums';

const INTEGRATION = { id: 'int-1', slug: 'uzum', is_active: true } as any;

const job = (over: any = {}) =>
  ({
    id: 'ob-1',
    integration_id: 'int-1',
    event_id: 'e-1',
    event_type: 'parcel.delivered',
    aggregate_type: 'parcel',
    aggregate_id: 'p-1',
    seq: 5,
    // `status.to` — worker `remote_status` nusxasini shundan yangilaydi.
    payload: {
      event_id: 'e-1',
      seq: 5,
      event_type: 'parcel.delivered',
      status: { from: 'ACCEPTED_BY_BEEPOST', to: 'DELIVERED' },
    },
    status: MarketplaceOutboxStatus.PROCESSING,
    attempts: 0,
    max_attempts: 8,
    ...over,
  }) as any;

function build(opts: {
  integration?: any;
  parcel?: any;
  send?: jest.Mock;
} = {}) {
  const updates: any[] = [];
  const parcelUpdates: any[] = [];

  const outboxRepo = {
    update: jest.fn(async (where: any, set: any) => { updates.push({ where, set }); }),
    createQueryBuilder: jest.fn(() => ({
      update: () => ({ set: () => ({ where: () => ({ andWhere: () => ({ execute: async () => ({ affected: 0 }) }) }) }) }),
    })),
  };
  const parcelRepo = {
    findOne: jest.fn(async () => (opts.parcel === undefined ? { id: 'p-1', last_sent_seq: 0 } : opts.parcel)),
    // ⚠️ Muvaffaqiyat yo'li endi XOM SQL ishlatadi: `last_sent_seq` bilan
    // birga `remote_status` ni ham yangilaydi (eski nusxa solishtiruvni
    // soxta nomuvofiqlikka to'ldirardi). Mock shu shaklni takrorlaydi.
    query: jest.fn(async (sql: string, params: any[]) => {
      parcelUpdates.push({ sql, params });
      return [];
    }),
  };
  const integrationRepo = {
    findOne: jest.fn(async () =>
      opts.integration === undefined ? INTEGRATION : opts.integration,
    ),
  };
  const api = {
    sendEvent: opts.send ?? jest.fn(async () => ({ ok: true, applied: true, http_status: 200 })),
  };

  const w = new MarketplaceOutboxWorker(
    outboxRepo as any, parcelRepo as any, integrationRepo as any,
    {} as any, api as any,
  );
  return { w, updates, parcelUpdates, api };
}

const deliver = (w: MarketplaceOutboxWorker, j: any) => (w as any).deliver(j);
const lastSet = (updates: any[]) => updates[updates.length - 1].set;

describe('MarketplaceOutboxWorker.deliver', () => {
  it("muvaffaqiyatda SENT qiladi va `last_sent_seq` ni oshiradi", async () => {
    const { w, updates, parcelUpdates, api } = build();
    await deliver(w, job());

    expect(api.sendEvent).toHaveBeenCalled();
    expect(lastSet(updates).status).toBe(MarketplaceOutboxStatus.SENT);

    const { sql, params } = parcelUpdates[0];
    // ⚠️ GREATEST — parallel yetkazishda kichikroq seq katta raqamni
    // ORQAGA SURIB yubormasin.
    expect(sql).toMatch(/GREATEST\("last_sent_seq"/);
    // ⚠️ `remote_status` HAM yangilanadi — aks holda solishtiruv ularning
    // jonli statusini bizning eskirgan nusxa bilan taqqoslab, har bir
    // yetkazilgan posilkani soxta nomuvofiq deb belgilardi.
    expect(sql).toMatch(/"remote_status" = CASE/);
    // Va u FAQAT seq ortda qolmaganda yoziladi.
    expect(sql).toMatch(/\$2 >= "last_sent_seq"/);
    expect(params[3]).toBe('DELIVERED');
  });

  it("yuborishda `sent_at` QO'SHADI (enqueue vaqti emas)", async () => {
    const { w, api } = build();
    await deliver(w, job());
    const env = (api.sendEvent as jest.Mock).mock.calls[0][1];
    expect(env.sent_at).toBeGreaterThan(0);
    // Navbatda 2 soat turgan hodisaning `sent_at` i enqueue vaqti bo'lmasin.
    expect(env.event_id).toBe('e-1');
  });

  it("KILL-SWITCH: o'chirilgan ulanishda YUBORMAYDI", async () => {
    // ⚠️ Mavjud kill-switch'lar faqat yangi hodisani to'sadi, navbatdagilar
    // baribir ketaveradi (reja §12).
    const { w, updates, api } = build({ integration: { ...INTEGRATION, is_active: false } });
    await deliver(w, job());

    expect(api.sendEvent).not.toHaveBeenCalled();
    expect(lastSet(updates).status).toBe(MarketplaceOutboxStatus.SKIPPED);
    // Qator SAQLANADI va sababi yoziladi — jimgina yo'qolish yo'q.
    expect(lastSet(updates).status_reason).toMatch(/o'chirilgan/);
  });

  it('ESKIRGAN hodisani yubormaydi (seq qo\'riqchisi)', async () => {
    // ⚠️ Reja §6.2: `sold` 502 olib kutayotganda `rollback` o'tib ketadi;
    // keyin eskirgan `sold` yetib borsa marketplace NOTO'G'RI terminal
    // holatda qolardi.
    const { w, updates, api } = build({ parcel: { id: 'p-1', last_sent_seq: 7 } });
    await deliver(w, job({ seq: 5 }));

    expect(api.sendEvent).not.toHaveBeenCalled();
    expect(lastSet(updates).status).toBe(MarketplaceOutboxStatus.SUPERSEDED);
    expect(lastSet(updates).status_reason).toMatch(/Eskirgan: seq 5 <= yuborilgan 7/);
  });

  it('ular `applied:false` (dublikat) desa ham MUVAFFAQIYAT', async () => {
    const send = jest.fn(async () => ({
      ok: true, applied: false, reason: 'DUPLICATE', http_status: 200,
    }));
    const { w, updates } = build({ send });
    await deliver(w, job());

    // Dublikat — ularning TO'G'RI xulqi (kontrakt §4.4), xato emas.
    expect(lastSet(updates).status).toBe(MarketplaceOutboxStatus.SENT);
    expect(lastSet(updates).status_reason).toMatch(/DUPLICATE/);
  });

  it('5xx da QAYTA URINADI (backoff bilan)', async () => {
    const send = jest.fn(async () => { throw { response: { status: 503 } }; });
    const { w, updates } = build({ send });
    await deliver(w, job({ attempts: 0 }));

    const set = lastSet(updates);
    expect(set.status).toBe(MarketplaceOutboxStatus.FAILED);
    expect(set.attempts).toBe(1);
    expect(set.next_retry_at).toBeGreaterThan(Date.now()); // 1 daqiqadan keyin
  });

  it('4xx da QAYTA URINMAYDI', async () => {
    // ⚠️ Mavjud worker HAR qanday muvaffaqiyatsiz javobni qayta uradi,
    // shu jumladan 400/422 ni — ular hech qachon o'zgarmaydi.
    const send = jest.fn(async () => { throw { response: { status: 422 } }; });
    const { w, updates } = build({ send });
    await deliver(w, job());

    const set = lastSet(updates);
    /**
     * ⚠️ `dropped` — `failed` EMAS, va bu MUHIM.
     *
     * `claim()` so'rovida `next_retry_at IS NULL` sharti bor, ya'ni
     * `failed` + `next_retry_at = null` «HOZIR tayyor» degani. Avval
     * bu yerda `retryable ? FAILED : FAILED` yozilgan edi (ikkala shox
     * bir xil), shu sabab «qayta urinilmaydi» deb belgilangan hodisa
     * aslida har 30 soniyada qayta yuborilar va urinish byudjetini
     * yeb bitirardi.
     */
    expect(set.status).toBe(MarketplaceOutboxStatus.DROPPED);
    expect(set.next_retry_at).toBeNull();
    expect(set.status_reason).toMatch(/Qayta urinilmaydi/);
  });

  it("`dropped` hodisa navbatdan CHIQADI — `claim` uni olmaydi", () => {
    // Statik qulf: `claim()` faqat `pending`/`failed` ni oladi.
    // Agar kimdir `dropped` ni ro'yxatga qo'shsa, qayta urinish halqasi
    // qaytadi — shuning uchun bu shart kod matnidan tekshiriladi.
    const src = readFileSync(
      join(__dirname, 'marketplace-outbox.worker.ts'),
      'utf8',
    );
    const claim = src.slice(src.indexOf('private async claim'));
    expect(claim).toMatch(/status" IN \('pending','failed'\)/);
    expect(claim.slice(0, 1500)).not.toMatch(/dropped/);
  });

  it('urinishlar tugaganda qayta urinmaydi', async () => {
    const send = jest.fn(async () => { throw { response: { status: 503 } }; });
    const { w, updates } = build({ send });
    await deliver(w, job({ attempts: 7, max_attempts: 8 }));

    const set = lastSet(updates);
    expect(set.attempts).toBe(8);
    expect(set.next_retry_at).toBeNull();
  });

  it("noma'lum ulanishda SKIPPED qiladi", async () => {
    const { w, updates, api } = build({ integration: null });
    await deliver(w, job());
    expect(api.sendEvent).not.toHaveBeenCalled();
    expect(lastSet(updates).status).toBe(MarketplaceOutboxStatus.SKIPPED);
  });
});

describe('MarketplaceOutboxWorker.processBatch — tartib kafolati', () => {
  it('bir posilkaning hodisasi yiqilsa, KEYINGILARI shu siklda urinilmaydi', async () => {
    /**
     * ⚠️ Aks holda: `seq 5` tarmoq xatosi bilan yiqiladi, `seq 6` o'tib
     * ketadi va `last_sent_seq` 6 bo'ladi — keyingi urinishda `seq 5`
     * «eskirgan» deb ABADIY tashlanadi. Agar 5 da PUL hodisasi bo'lsa,
     * hamkor pulni hech qachon ko'rmaydi.
     */
    const send = jest.fn(async () => {
      throw { response: { status: 503 } };
    });
    const { w, updates } = build({ send });

    const a = job({ id: 'ob-a', event_id: 'e-a', seq: 5 });
    const b = job({ id: 'ob-b', event_id: 'e-b', seq: 6 });
    (w as any).claim = async () => [a, b];

    await (w as any).processBatch();

    // Faqat BIRINCHISIGA urinildi.
    expect(send).toHaveBeenCalledTimes(1);

    // Ikkinchisi `pending` ga QAYTARILDI — keyingi sikl tartib bilan oladi.
    const second = updates.filter((u: any) => u.where?.id === 'ob-b');
    expect(second.length).toBe(1);
    expect(second[0].set.status).toBe(MarketplaceOutboxStatus.PENDING);
    expect(String(second[0].set.status_reason)).toMatch(/tartib/i);
  });
});
