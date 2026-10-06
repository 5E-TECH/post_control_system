import { Context } from 'telegraf';
import { BotService } from './bot.service';
import { Group_type, Roles, Status } from 'src/common/enums';

/**
 * NOTIFY-BOT `addToGroup` DARVOZALARI.
 *
 * ── NEGA BU TEST KERAK ──────────────────────────────────────────────────
 *
 * Bu oqim ilgari order-botga qaraganda ANCHA bo'sh edi: chat turi ham,
 * foydalanuvchi roli ham, market bloki ham tekshirilmasdi. Oqibati prod
 * bazasida ko'rinadi — `8810` marketining `cancel` qatorida
 * `group_id = 1320841140`, ya'ni MUSBAT son. Telegramda guruh id'lari
 * manfiy, musbat son = bir odamning SHAXSIY chati. Demak o'sha
 * marketning bekor qilish xabarlari 2026-07-08 dan beri shaxsiy chatga
 * oqmoqda.
 *
 * ⚠️ `addToGroup` HECH QACHON istisno OTMAYDI — `catch` bloki hammasini
 * yutib `{ message }` qaytaradi (bot foydalanuvchisiga matn ko'rsatish
 * uchun). Shu sabab bu yerda `rejects.toThrow` ISHLAMAYDI. Rad etilganini
 * `save` CHAQIRILMAGANI va `rollbackTransaction` chaqirilgani bilan
 * tekshiramiz — bu ancha ishonchli mezon.
 */

const TOKEN = 'group_token-abc';

type Row = { group_type: Group_type | null; group_id: string };

function setup(opts: {
  chatType?: string;
  market?: Record<string, unknown> | null;
  rows?: Row[];
}) {
  const manager = {
    findOne: jest.fn().mockResolvedValue(
      opts.market === undefined
        ? { id: 'm-1', name: 'Test', role: Roles.MARKET, status: Status.ACTIVE }
        : opts.market,
    ),
    find: jest.fn().mockResolvedValue(opts.rows ?? []),
    create: jest.fn((_e: unknown, v: unknown) => v),
    save: jest.fn().mockResolvedValue({}),
  };
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };
  const svc = Object.create(BotService.prototype) as BotService;
  (svc as unknown as { dataSource: unknown }).dataSource = {
    createQueryRunner: () => queryRunner,
  };

  const ctx = {
    chat: { id: -1001234567890, type: opts.chatType ?? 'supergroup' },
  } as unknown as Context;

  return { svc, manager, queryRunner, ctx };
}

/** Amal RAD ETILGANINI tekshirish — yozuv yo'q va rollback bo'lgan. */
function expectRejected(manager: any, queryRunner: any) {
  expect(manager.save).not.toHaveBeenCalled();
  expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
}

describe('notify-bot addToGroup — DARVOZA 1: faqat guruh', () => {
  it.each(['private', 'channel'])('%s chat RAD etiladi', async (chatType) => {
    const { svc, manager, queryRunner, ctx } = setup({ chatType });
    await svc.addToGroup(TOKEN, ctx);

    expectRejected(manager, queryRunner);
    // Market qidirilmasligi ham kerak — darvoza eng boshida.
    expect(manager.findOne).not.toHaveBeenCalled();
  });

  it.each(['group', 'supergroup'])('%s chat o\'tadi', async (chatType) => {
    const { svc, queryRunner, ctx } = setup({ chatType });
    await svc.addToGroup(TOKEN, ctx);

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });
});

describe('notify-bot addToGroup — DARVOZA 2: rol filtri', () => {
  it('market qidiruvi `role: MARKET` bilan bajariladi', async () => {
    const { svc, manager, ctx } = setup({});
    await svc.addToGroup(TOKEN, ctx);

    expect(manager.findOne).toHaveBeenCalledWith(expect.anything(), {
      where: { market_tg_token: TOKEN, role: Roles.MARKET },
    });
  });

  it('market topilmasa RAD etiladi', async () => {
    const { svc, manager, queryRunner, ctx } = setup({ market: null });
    await svc.addToGroup(TOKEN, ctx);

    expectRejected(manager, queryRunner);
  });
});

describe('notify-bot addToGroup — DARVOZA 3: bloklangan market', () => {
  it('nofaol market RAD etiladi', async () => {
    const { svc, manager, queryRunner, ctx } = setup({
      market: {
        id: 'm-1',
        name: 'Bloklangan',
        role: Roles.MARKET,
        status: Status.INACTIVE,
      },
    });
    await svc.addToGroup(TOKEN, ctx);

    expectRejected(manager, queryRunner);
  });
});

describe('notify-bot addToGroup — DARVOZA 4: guruh takroran ulanmasin', () => {
  const CASES: Array<[string, Row[], boolean]> = [
    ['qator yo\'q', [], true],
    ['faqat `create` qatori bor', [{ group_type: Group_type.CREATE, group_id: '-1' }], true],
    ['`cancel` qatori bor', [{ group_type: Group_type.CANCEL, group_id: '-1' }], false],
    /**
     * ⚠️ Eski NULL qator ham TO'QNASHUV. Avvalgi shart
     * `group_type: Group_type.CANCEL || null` edi — O'LIK yozuv, chunki
     * chapdagi qiymat bo'sh bo'lmagan satr. Shu sabab eski qatorli
     * guruhlar tekshiruvdan o'tib ketib, ikki marta ulanardi.
     */
    ['eski (NULL) qator bor', [{ group_type: null, group_id: '-1' }], false],
  ];

  it.each(CASES)('%s -> ruxsat: %s', async (_nom, rows, ruxsat) => {
    const { svc, manager, queryRunner, ctx } = setup({ rows });
    await svc.addToGroup(TOKEN, ctx);

    if (ruxsat) {
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    } else {
      expectRejected(manager, queryRunner);
    }
  });
});

describe('notify-bot addToGroup — javobda token sizmaydi', () => {
  it('faqat `market_id` qaytadi', async () => {
    const { svc, ctx } = setup({});
    const res = (await svc.addToGroup(TOKEN, ctx)) as {
      data?: Record<string, unknown>;
      message?: string;
    };

    expect(res.data).toEqual({ market_id: 'm-1' });
    expect(JSON.stringify(res)).not.toMatch(/group_token-/);
  });
});
