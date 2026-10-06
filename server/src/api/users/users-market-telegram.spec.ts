import { Roles, Status, Group_type } from 'src/common/enums';
import { UserService } from './users.service';
import { JwtPayload } from 'src/common/utils/types/user.type';

/**
 * MARKET TELEGRAM PANELI — ko'rish va ulanishni uzish.
 *
 * Admin market kartochkasida nechta operator borligini, ulardan
 * nechtasi Telegram orqali ulanganini va qaysi guruhlar biriktirilganini
 * ko'radi; noto'g'ri ulanishni uzib qo'yishi mumkin.
 *
 * ⚠️ Ulanishni uzish QAYTARIB BO'LMAYDI (jadvalda soft-delete yo'q),
 * shuning uchun bu yerdagi ikki qo'riqchi test muhim:
 *   · boshqa marketning ulanishini o'chirib bo'lmaydi;
 *   · o'chirilgan qator audit logga yoziladi, lekin TOKENSIZ.
 */

const ADMIN = { role: Roles.SUPERADMIN, id: 'a-1' } as JwtPayload;
const MARKET = { id: 'm-1', name: 'Test market', role: Roles.MARKET };

const OPS = [
  { id: 'o-1', name: 'Tg operator', phone_number: '+998901112233', status: Status.ACTIVE, telegram_id: 12345, created_at: 3 },
  { id: 'o-2', name: 'Platforma', phone_number: '+998901112234', status: Status.ACTIVE, telegram_id: null, created_at: 2 },
  { id: 'o-3', name: 'Nofaol', phone_number: '+998901112235', status: Status.INACTIVE, telegram_id: null, created_at: 1 },
];

const GROUPS = [
  { id: 'g-1', group_type: Group_type.CREATE, group_id: '-5255783895', created_at: 2, token: 'group_token-sir' },
  { id: 'g-2', group_type: Group_type.CANCEL, group_id: '1320841140', created_at: 1, token: 'group_token-sir2' },
  { id: 'g-3', group_type: null, group_id: '-4825228803', created_at: 0, token: 'group_token-sir3' },
];

function makeSvc(opts: { market?: unknown; ops?: unknown[]; groups?: unknown[]; conn?: unknown } = {}) {
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(
      opts.market === undefined ? MARKET : opts.market,
    ),
    find: jest.fn().mockResolvedValue(opts.ops ?? OPS),
  };
  const manager = {
    find: jest.fn().mockResolvedValue(opts.groups ?? GROUPS),
    findOne: jest.fn().mockResolvedValue(
      opts.conn === undefined ? GROUPS[1] : opts.conn,
    ),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const activityLog = { log: jest.fn() };
  const svc = Object.create(UserService.prototype) as UserService;
  (svc as unknown as { userRepo: unknown }).userRepo = userRepo;
  (svc as unknown as { dataSource: unknown }).dataSource = { manager };
  (svc as unknown as { activityLog: unknown }).activityLog = activityLog;
  return { svc, userRepo, manager, activityLog };
}

const body = (res: unknown) =>
  (res as { data?: any }).data ?? {};

describe('marketTelegramOverview() — operator hisobi', () => {
  it('jami / telegram / platforma / nofaol sonlarini to\'g\'ri sanaydi', async () => {
    const { svc } = makeSvc();
    const d = body(await svc.marketTelegramOverview('m-1'));

    expect(d.operators.total).toBe(3);
    expect(d.operators.telegram).toBe(1);
    expect(d.operators.platform).toBe(2);
    expect(d.operators.inactive).toBe(1);
    // telegram + platforma HAR DOIM jamiga teng bo'lishi kerak.
    expect(d.operators.telegram + d.operators.platform).toBe(d.operators.total);
  });

  /** ⚠️ `telegram_id` ning O'ZI javobga tushmasligi kerak. */
  it('telegram_id qiymatini oshkor qilmaydi', async () => {
    const { svc } = makeSvc();
    const res = await svc.marketTelegramOverview('m-1');

    expect(body(res).operators.items[0].has_telegram).toBe(true);
    expect(JSON.stringify(res)).not.toMatch(/12345/);
  });

  it("o'chirilgan operatorlar so'ralmaydi", async () => {
    const { svc, userRepo } = makeSvc();
    await svc.marketTelegramOverview('m-1');

    expect(userRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ is_deleted: false }),
      }),
    );
  });

  it('operator yo\'q bo\'lsa nollar qaytadi', async () => {
    const { svc } = makeSvc({ ops: [] });
    const d = body(await svc.marketTelegramOverview('m-1'));
    expect(d.operators).toMatchObject({ total: 0, telegram: 0, platform: 0 });
  });

  it('market topilmasa 404', async () => {
    const { svc } = makeSvc({ market: null });
    await expect(svc.marketTelegramOverview('yoq')).rejects.toThrow();
  });
});

describe('marketTelegramOverview() — guruhlar', () => {
  /**
   * ⚠️ Telegramda guruh id'lari MANFIY, shaxsiy chat id'lari MUSBAT.
   * Prod bazasida musbat id'li qator bor (8810, 1320841140) — market
   * xabarlari bir odamning shaxsiy chatiga oqmoqda. Admin buni
   * ko'rishi uchun belgilanadi.
   */
  it('musbat group_id ni shaxsiy chat deb belgilaydi', async () => {
    const { svc } = makeSvc();
    const g = body(await svc.marketTelegramOverview('m-1')).groups;

    expect(g.find((x: any) => x.id === 'g-2').is_private_chat).toBe(true);
    expect(g.find((x: any) => x.id === 'g-1').is_private_chat).toBe(false);
    expect(g.find((x: any) => x.id === 'g-3').is_private_chat).toBe(false);
  });

  it("turi belgilanmagan qatorni `null` bilan ko'rsatadi", async () => {
    const { svc } = makeSvc();
    const g = body(await svc.marketTelegramOverview('m-1')).groups;
    expect(g.find((x: any) => x.id === 'g-3').group_type).toBeNull();
  });

  /** ⚠️ `token` javobga TUSHMASLIGI shart — u sir. */
  it('guruh tokenini oshkor qilmaydi', async () => {
    const { svc } = makeSvc();
    const res = await svc.marketTelegramOverview('m-1');
    expect(JSON.stringify(res)).not.toMatch(/group_token-/);
  });
});

describe('disconnectMarketTelegram()', () => {
  it("ulanishni o'chiradi", async () => {
    const { svc, manager } = makeSvc();
    await svc.disconnectMarketTelegram('m-1', 'g-2', ADMIN);

    expect(manager.delete).toHaveBeenCalledWith(expect.anything(), {
      id: 'g-2',
      market_id: 'm-1',
    });
  });

  /**
   * ⚠️ ENG MUHIM QO'RIQCHI: boshqa marketning ulanishini o'chirib
   * bo'lmasligi. Qidiruv HAM `id`, HAM `market_id` bo'yicha bo'lishi shart.
   */
  it("qidiruv `market_id` bilan ham cheklanadi", async () => {
    const { svc, manager } = makeSvc();
    await svc.disconnectMarketTelegram('m-1', 'g-2', ADMIN);

    expect(manager.findOne).toHaveBeenCalledWith(expect.anything(), {
      where: { id: 'g-2', market_id: 'm-1' },
    });
  });

  it("boshqa marketniki bo'lsa 404 va O'CHIRMAYDI", async () => {
    const { svc, manager } = makeSvc({ conn: null });
    await expect(
      svc.disconnectMarketTelegram('m-1', 'boshqa', ADMIN),
    ).rejects.toThrow();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  /** Soft-delete yo'q — tiklash uchun yagona manba audit log. */
  it("o'chirilgan qatorni audit logga yozadi", async () => {
    const { svc, activityLog } = makeSvc();
    await svc.disconnectMarketTelegram('m-1', 'g-2', ADMIN);

    const call = activityLog.log.mock.calls[0][0];
    // ⚠️ `deleted` EMAS — market tirik qoladi (loglarda chalg'itmasin).
    expect(call.action).toBe('telegram_disconnected');
    expect(call.old_value).toMatchObject({
      telegram_connection_id: 'g-2',
      group_id: '1320841140',
    });
  });

  it('logga tokenni yozmaydi', async () => {
    const { svc, activityLog } = makeSvc();
    await svc.disconnectMarketTelegram('m-1', 'g-2', ADMIN);

    expect(JSON.stringify(activityLog.log.mock.calls[0][0])).not.toMatch(
      /group_token-/,
    );
  });
});

/**
 * AMALDAGI YO'NALISH — eng nozik qism.
 *
 * `group_type` ning o'zi yetarli emas: server `cancel` uchun ZAXIRAGA ega
 * (telegram-group.util.ts). Typed `cancel` uzilsa, turi BO'SH qator FAOL
 * kanalga aylanadi. Panel buni ko'rsatmasa admin qizil «Shaxsiy chat»
 * belgisiga amal qilib uzadi, "tuzatdim" deb o'ylaydi — holbuki mijoz
 * ma'lumotlari boshqa chatga oqishda davom etadi.
 */
describe('marketTelegramOverview() — amaldagi yo\'nalish', () => {
  it('typed `cancel` bor: eski qator UXLAB turadi', async () => {
    const { svc } = makeSvc(); // GROUPS: create + cancel + null
    const g = body(await svc.marketTelegramOverview('m-1')).groups;

    const cancel = g.find((x: any) => x.id === 'g-2');
    const legacy = g.find((x: any) => x.id === 'g-3');

    expect(cancel.receives_cancel).toBe(true);
    expect(legacy.receives_cancel).toBe(false);
    expect(legacy.is_dormant_fallback).toBe(true);
  });

  it('typed `cancel` YO\'Q: eski qator FAOL kanal', async () => {
    const { svc } = makeSvc({
      groups: [
        { id: 'g-3', group_type: null, group_id: '-4825228803', created_at: 0, token: 'group_token-x' },
      ],
    });
    const g = body(await svc.marketTelegramOverview('m-1')).groups;

    expect(g[0].receives_cancel).toBe(true);
    // Zaxira EMAS — u allaqachon ishlab turgan kanal.
    expect(g[0].is_dormant_fallback).toBe(false);
  });

  it('`create` qatori bekor qilish kanali HISOBLANMAYDI', async () => {
    const { svc } = makeSvc();
    const g = body(await svc.marketTelegramOverview('m-1')).groups;
    const create = g.find((x: any) => x.id === 'g-1');

    expect(create.receives_cancel).toBe(false);
    expect(create.is_dormant_fallback).toBe(false);
  });
});

describe('disconnectMarketTelegram() — zaxira ogohlantirishi', () => {
  /**
   * ⚠️ Eng muhim qo'riqchi: uzish oqimni TO'XTATMAGANDA admin buni
   * bilishi SHART. Aks holda u "tuzatdim" deb o'ylaydi.
   */
  it('typed `cancel` uzilsa zaxira faollashishini aytadi', async () => {
    const LEGACY = { id: 'g-3', group_type: null, group_id: '-4825228803', created_at: 0 };
    const { svc, manager, activityLog } = makeSvc({ conn: GROUPS[1] });
    // `find` zaxira so'rovi uchun eski qatorni qaytaradi.
    manager.find.mockResolvedValue([LEGACY]);

    const res: any = await svc.disconnectMarketTelegram('m-1', 'g-2', ADMIN);

    expect(res.message).toMatch(/TO'XTAMADI/);
    expect(res.message).toContain('-4825228803');
    expect(res.data.fallback_activated).toEqual([
      { id: 'g-3', group_id: '-4825228803' },
    ]);
    // Auditda ham qolishi kerak — keyin tergov qilish uchun.
    expect(activityLog.log.mock.calls[0][0].old_value.activates_fallback).toEqual([
      { id: 'g-3', group_id: '-4825228803' },
    ]);
  });

  it('zaxira yo\'q bo\'lsa oddiy xabar', async () => {
    const { svc, manager } = makeSvc({ conn: GROUPS[1] });
    manager.find.mockResolvedValue([]);

    const res: any = await svc.disconnectMarketTelegram('m-1', 'g-2', ADMIN);
    expect(res.message).toBe('Ulanish uzildi');
  });

  /** `create` uzilganda zaxira mantig'i UMUMAN ishlamaydi. */
  it('`create` uzilsa zaxira qidirilmaydi', async () => {
    const { svc, manager } = makeSvc({ conn: GROUPS[0] });
    await svc.disconnectMarketTelegram('m-1', 'g-1', ADMIN);

    // `find` faqat overview'da ishlatiladi; bu yerda chaqirilmasligi kerak.
    expect(manager.find).not.toHaveBeenCalled();
  });
});
