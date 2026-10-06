import { IsNull } from 'typeorm';
import { Group_type } from 'src/common/enums';
import { findMarketGroup, findMarketGroups } from './telegram-group.util';

/**
 * ESKI (group_type BO'SH) TELEGRAM QATORLARI UCHUN ZAXIRA MANTIG'I.
 *
 * Bu testning BUTUN MA'NOSI — UCH holatni ajratish:
 *
 *   1. `cancel` so'ralgan, turi belgilangan qator YO'Q
 *      -> eski NULL qatorga tushiladi              (TUZATISH)
 *
 *   2. `cancel` so'ralgan, turi belgilangan qator BOR
 *      -> NULL qatorga TUSHILMAYDI                 (TAKROR YO'Q)
 *
 *   3. `create` so'ralgan
 *      -> NULL qatorga HECH QACHON tushilmaydi     (REGRESSIYA YO'Q)
 *
 * ⚠️ Uchinchisi eng muhimi va eng oson unutiladigani. `create` DARVOZA:
 * guruh topilsa buyurtma `CREATED` ga o'tib ✅ tugmasini kutadi, tugma
 * esa `order-bot.service.ts:591-597` da QAT'IY `group_type: CREATE`
 * qidiradi. Eski qator u tekshiruvdan o'tmaydi -> buyurtma `CREATED` da
 * qotadi va default ro'yxatda KO'RINMAYDI (order.service.ts:249-254).
 */

/** `manager.find` ni taqlid qiladi: har chaqiruvda `where` ga qarab javob beradi. */
function fakeManager(
  rows: Array<{ group_type: Group_type | null; group_id: string }>,
) {
  const find = jest.fn(async (_entity: unknown, opts: any) => {
    const want = opts.where.group_type;
    // `IsNull()` FindOperator obyekti; oddiy tur esa satr.
    const wantsNull = typeof want === 'object' && want !== null;
    return rows.filter((r) =>
      wantsNull ? r.group_type === null : r.group_type === want,
    );
  });
  return { manager: { find } as any, find };
}

const CREATE_ROW = { group_type: Group_type.CREATE, group_id: '-100create' };
const CANCEL_ROW = { group_type: Group_type.CANCEL, group_id: '-100cancel' };
const LEGACY_ROW = { group_type: null, group_id: '-100legacy' };

describe('findMarketGroups — `cancel` uchun eski qatorlarga zaxira', () => {
  it("turi belgilangan qator YO'Q bo'lsa eski NULL qatorga tushadi", async () => {
    const { manager } = fakeManager([LEGACY_ROW]);
    const rows = await findMarketGroups(manager, 'm-1', Group_type.CANCEL);

    expect(rows.map((r) => r.group_id)).toEqual(['-100legacy']);
  });

  /**
   * ⚠️ `8810` marketi holati: HAM eski, HAM yangi qator bor.
   * Eski qator ishlatilsa xabar IKKI marta ketardi.
   */
  it("turi belgilangan qator BOR bo'lsa eski qator E'TIBORSIZ qoladi", async () => {
    const { manager, find } = fakeManager([CANCEL_ROW, LEGACY_ROW]);
    const rows = await findMarketGroups(manager, 'm-1', Group_type.CANCEL);

    expect(rows.map((r) => r.group_id)).toEqual(['-100cancel']);
    // Zaxira so'rovi UMUMAN yuborilmasligi kerak.
    expect(find).toHaveBeenCalledTimes(1);
  });

  it("boshqa turdagi qator zaxirani to'smaydi", async () => {
    // Faqat `create` bor; `cancel` so'ralganda eski qatorga tushish SHART.
    const { manager } = fakeManager([CREATE_ROW, LEGACY_ROW]);
    const rows = await findMarketGroups(manager, 'm-1', Group_type.CANCEL);

    expect(rows.map((r) => r.group_id)).toEqual(['-100legacy']);
  });

  it("zaxira so'rovi IsNull() bilan yuboriladi", async () => {
    const { manager, find } = fakeManager([LEGACY_ROW]);
    await findMarketGroups(manager, 'm-1', Group_type.CANCEL);

    expect(find.mock.calls[1][1].where).toEqual({
      market_id: 'm-1',
      group_type: IsNull(),
    });
  });
});

describe('findMarketGroups — `create` uchun zaxira YO\'Q (regressiya qulfi)', () => {
  /**
   * ⚠️ BU TESTNI O'ZGARTIRMANG. U buyurtmaning `CREATED` da qotib
   * qolishiga qarshi yagona avtomatik to'siq.
   */
  it('faqat eski qator bo\'lsa ham `create` uchun BO\'SH qaytaradi', async () => {
    const { manager, find } = fakeManager([LEGACY_ROW]);
    const rows = await findMarketGroups(manager, 'm-1', Group_type.CREATE);

    expect(rows).toEqual([]);
    // Ikkinchi (IsNull) so'rov umuman yuborilmasligi kerak.
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('turi belgilangan `create` qatori bo\'lsa uni qaytaradi', async () => {
    const { manager } = fakeManager([CREATE_ROW, LEGACY_ROW]);
    const rows = await findMarketGroups(manager, 'm-1', Group_type.CREATE);

    expect(rows.map((r) => r.group_id)).toEqual(['-100create']);
  });
});

describe('findMarketGroups — chegaraviy holatlar', () => {
  it("hech qanday qator bo'lmasa bo'sh massiv", async () => {
    const { manager } = fakeManager([]);
    expect(await findMarketGroups(manager, 'm-1', Group_type.CANCEL)).toEqual(
      [],
    );
  });

  it("marketId bo'sh bo'lsa so'rov umuman yuborilmaydi", async () => {
    const { manager, find } = fakeManager([LEGACY_ROW]);
    expect(await findMarketGroups(manager, '', Group_type.CANCEL)).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });
});

describe('findMarketGroup — bitta qator qaytaradi', () => {
  it('topilsa birinchisini qaytaradi', async () => {
    const { manager } = fakeManager([CANCEL_ROW]);
    const row = await findMarketGroup(manager, 'm-1', Group_type.CANCEL);
    expect(row?.group_id).toBe('-100cancel');
  });

  it('topilmasa null qaytaradi (undefined EMAS)', async () => {
    const { manager } = fakeManager([]);
    expect(await findMarketGroup(manager, 'm-1', Group_type.CANCEL)).toBeNull();
  });
});
