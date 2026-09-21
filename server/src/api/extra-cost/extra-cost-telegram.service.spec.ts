/// <reference types="jest" />
import { Repository } from 'typeorm';
import { Telegraf } from 'telegraf';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { ExtraCostStatus, Roles } from 'src/common/enums';
import { ExtraCostTelegramService } from './extra-cost-telegram.service';

/**
 * TELEGRAM XABARI — ISBOT + TUGMALAR.
 *
 * Bu servis pulga tegmaydi, lekin uch narsa noto'g'ri bo'lsa oqibati og'ir:
 *
 *   MAXFIYLIK   — isbot (mijoz eshigi, cheki) GURUHGA emas, faqat market
 *                 EGASIGA DM bilan ketishi kerak.
 *   YETIB BORISH— market botga ulanmagan bo'lsa (bugun 12 dan 12 tasi
 *                 shunday) matnli zaxira kanal ishlashi kerak, ya'ni bu
 *                 servis `false` qaytarishi shart.
 *   BIR POST    — foydalanuvchi "isbot va matn BITTA post bo'lsin" deb
 *                 aytgan: bitta fayl bo'lsa izoh + tugma o'sha postda.
 */

const bot = () => {
  const calls: Array<{ method: string; args: any[] }> = [];
  const rec =
    (method: string) =>
    (...args: any[]) => {
      calls.push({ method, args });
      return Promise.resolve({ message_id: 1 });
    };
  const t = {
    telegram: {
      sendMessage: jest.fn(rec('sendMessage')),
      sendPhoto: jest.fn(rec('sendPhoto')),
      sendVideo: jest.fn(rec('sendVideo')),
      sendMediaGroup: jest.fn(rec('sendMediaGroup')),
    },
  } as unknown as Telegraf;
  return { t, calls };
};

const userRepo = (user: Partial<UserEntity> | null) =>
  ({
    findOne: jest.fn(() => Promise.resolve(user)),
  }) as unknown as Repository<UserEntity>;

const proofRepo = (rows: Array<Partial<ExtraCostProofEntity>>) =>
  ({
    find: jest.fn(() => Promise.resolve(rows)),
  }) as unknown as Repository<ExtraCostProofEntity>;

const request = (
  over: Partial<ExtraCostRequestEntity> = {},
): ExtraCostRequestEntity =>
  ({
    id: 'r1',
    market_id: 'm1',
    courier_id: 'c1',
    order_number: 100042,
    amount: 15000,
    limit_max: 20000,
    status: ExtraCostStatus.PENDING,
    proof_ids: [],
    dup_proof_count: 0,
    courier_name: 'Abdurahmon',
    customer_name: 'Mijoz',
    customer_phone: '+998901112233',
    region_name: 'Toshkent',
    district_name: 'Chilonzor',
    ...over,
  }) as ExtraCostRequestEntity;

const OWNER = { id: 'm1', telegram_id: 777111, role: Roles.MARKET };

describe('Telegram xabari — yuborish yo‘llari', () => {
  it('TG1: isbotsiz → matn + tugmalar', async () => {
    const { t, calls } = bot();
    const svc = new ExtraCostTelegramService(t, userRepo(OWNER), proofRepo([]));

    await expect(svc.sendRequest(request())).resolves.toBe(true);
    expect(calls.map((c) => c.method)).toEqual(['sendMessage']);
    const [chatId, text, opts] = calls[0].args;
    expect(chatId).toBe(777111);
    expect(text).toContain('100042');
    expect(opts.reply_markup.inline_keyboard[0]).toHaveLength(2);
  });

  it('TG2: BITTA rasm → sendPhoto, izoh VA tugma AYNI postda', async () => {
    // Foydalanuvchi talabi: "isboti hamda textni bitta post qilib tashlab
    // bersin". Bitta fayl uchun bu Telegramda mumkin.
    const { t, calls } = bot();
    const svc = new ExtraCostTelegramService(
      t,
      userRepo(OWNER),
      proofRepo([
        {
          id: 'p1',
          rel_path: '2026/09',
          stored_name: 'a.jpg',
          mime: 'image/jpeg',
        },
      ]),
    );

    await svc.sendRequest(request({ proof_ids: ['p1'] }));
    expect(calls.map((c) => c.method)).toEqual(['sendPhoto']);
    const opts = calls[0].args[2];
    expect(opts.caption).toContain('100042');
    expect(opts.reply_markup).toBeDefined();
  });

  it('TG3: BITTA video → sendVideo (rasm sifatida yuborilmaydi)', async () => {
    const { t, calls } = bot();
    const svc = new ExtraCostTelegramService(
      t,
      userRepo(OWNER),
      proofRepo([
        {
          id: 'p1',
          rel_path: '2026/09',
          stored_name: 'a.mp4',
          mime: 'video/mp4',
        },
      ]),
    );

    await svc.sendRequest(request({ proof_ids: ['p1'] }));
    expect(calls.map((c) => c.method)).toEqual(['sendVideo']);
  });

  it('TG4: BIR NECHTA fayl → albom + ALOHIDA tugma xabari', async () => {
    // ⚠️ Telegram media-guruhga inline tugma qo'yishga ruxsat bermaydi —
    // shuning uchun tugmalar keyingi xabarda. Bu API cheklovi, tanlov emas.
    const { t, calls } = bot();
    const svc = new ExtraCostTelegramService(
      t,
      userRepo(OWNER),
      proofRepo([
        { id: 'p1', rel_path: 'x', stored_name: 'a.jpg', mime: 'image/jpeg' },
        { id: 'p2', rel_path: 'x', stored_name: 'b.mp4', mime: 'video/mp4' },
      ]),
    );

    await svc.sendRequest(request({ proof_ids: ['p1', 'p2'] }));
    expect(calls.map((c) => c.method)).toEqual([
      'sendMediaGroup',
      'sendMessage',
    ]);

    const album = calls[0].args[1];
    expect(album).toHaveLength(2);
    expect(album[0].type).toBe('photo');
    expect(album[1].type).toBe('video');
    // Izoh faqat BIRINCHISIDA — albomda u butun guruhga tegishli.
    expect(album[0].caption).toContain('100042');
    expect(album[1].caption).toBeUndefined();
    expect(calls[1].args[2].reply_markup).toBeDefined();
  });

  it('TG5: isbot tartibi SAQLANADI', async () => {
    const { t, calls } = bot();
    const svc = new ExtraCostTelegramService(
      t,
      userRepo(OWNER),
      // Repozitoriy tartibi TESKARI qaytaradi — servis `proof_ids` tartibini
      // tiklashi kerak (kuryer birinchi rasmni asosiy deb yuklaydi).
      proofRepo([
        { id: 'p2', rel_path: 'x', stored_name: 'b.jpg', mime: 'image/jpeg' },
        { id: 'p1', rel_path: 'x', stored_name: 'a.jpg', mime: 'image/jpeg' },
      ]),
    );

    await svc.sendRequest(request({ proof_ids: ['p1', 'p2'] }));
    const album = calls[0].args[1];
    expect(String(album[0].media.source)).toContain('a.jpg');
    expect(String(album[1].media.source)).toContain('b.jpg');
  });
});

describe('Telegram xabari — YUBORILMAYDIGAN holatlar', () => {
  it('TG6: `awaiting_proof` YUBORILMAYDI', async () => {
    // Isbotsiz so'rov marketga HALI yuborilmagan — u panelda ham
    // ko'rinmaydi. Xabar yuborish marketni bo'sh sahifaga olib borardi.
    const { t, calls } = bot();
    const svc = new ExtraCostTelegramService(t, userRepo(OWNER), proofRepo([]));
    await expect(
      svc.sendRequest(request({ status: ExtraCostStatus.AWAITING_PROOF })),
    ).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('TG7: market botga ulanmagan → `false` (matnli zaxira ishlaydi)', async () => {
    // Bugungi holat: 12 marketdan hech birida `telegram_id` yo'q.
    const { t, calls } = bot();
    const svc = new ExtraCostTelegramService(
      t,
      userRepo({ id: 'm1', telegram_id: null as any }),
      proofRepo([]),
    );
    await expect(svc.sendRequest(request())).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('TG8: Telegram xatosi TASHLANMAYDI', async () => {
    const t = {
      telegram: {
        sendMessage: jest.fn(() => Promise.reject(new Error('blocked'))),
      },
    } as unknown as Telegraf;
    const svc = new ExtraCostTelegramService(t, userRepo(OWNER), proofRepo([]));
    await expect(svc.sendRequest(request())).resolves.toBe(false);
  });
});

describe('Telegram xabari — izoh mazmuni', () => {
  const caption = async (over: Partial<ExtraCostRequestEntity> = {}) => {
    const { t, calls } = bot();
    const svc = new ExtraCostTelegramService(t, userRepo(OWNER), proofRepo([]));
    await svc.sendRequest(request(over));
    return String(calls[0].args[1]);
  };

  it('TG9: kuryer, mijoz, telefon va manzil bor (band 2)', async () => {
    const text = await caption();
    expect(text).toContain('Abdurahmon');
    expect(text).toContain('+998901112233');
    expect(text).toContain('Toshkent, Chilonzor');
  });

  it('TG10: DUBLIKAT isbot ogohlantirishi ko‘rinadi', async () => {
    const text = await caption({ dup_proof_count: 3 });
    expect(text).toContain('yana 2 ta');
  });

  it('TG11: Markdown ISHLATILMAYDI (nomdagi `_` xabarni buzmasin)', async () => {
    const { t, calls } = bot();
    const svc = new ExtraCostTelegramService(t, userRepo(OWNER), proofRepo([]));
    await svc.sendRequest(request({ customer_name: 'Ali_Vali *test*' }));
    const opts = calls[0].args[2];
    expect(opts.parse_mode).toBeUndefined();
    expect(String(calls[0].args[1])).toContain('Ali_Vali *test*');
  });

  it('TG12: izoh Telegram chegarasidan (1024) oshmaydi', async () => {
    // ⚠️ 1024 dan oshsa Telegram 400 qaytaradi va xabar UMUMAN yetmaydi —
    // ya'ni uzun nom butun tasdiqlash oqimini jimgina o'chirib qo'yardi.
    const text = await caption({
      courier_name: 'A'.repeat(500),
      customer_name: 'B'.repeat(500),
      district_name: 'C'.repeat(500),
      region_name: 'D'.repeat(500),
      customer_phone: 'E'.repeat(200),
    });
    expect(text.length).toBeLessThan(1024);
    // Qirqilgan bo'lsa ham eng muhim ma'lumot joyida qoladi.
    expect(text).toContain('100042');
  });
});

describe('Tugma avtorizatsiyasi — ODAM bo‘yicha', () => {
  it('TG13: `from.id` bo‘lmasa — `null`', async () => {
    const { t } = bot();
    const svc = new ExtraCostTelegramService(t, userRepo(OWNER), proofRepo([]));
    await expect(svc.resolveMarketOwner(undefined)).resolves.toBeNull();
  });

  it('TG14: faqat MARKET roli so‘raladi', async () => {
    // ⚠️ Operator yoki kuryer o'z `telegram_id` si bilan tugmani bossa,
    // so'rov `role: MARKET` shartiga tushmaydi va hech narsa topilmaydi.
    const repo = userRepo(OWNER);
    const { t } = bot();
    const svc = new ExtraCostTelegramService(t, repo, proofRepo([]));
    await svc.resolveMarketOwner(777111);
    const where = (repo.findOne as jest.Mock).mock.calls[0][0].where;
    expect(where.role).toBe(Roles.MARKET);
    expect(where.telegram_id).toBe(777111);
    expect(where.is_deleted).toBe(false);
  });
});

describe('Rad etish sabablari — tugmalar', () => {
  it('TG15: “sababsiz rad etish” tugmasi YO‘Q', async () => {
    // Sabab majburiy: kuryer nega rad etilganini bilmasa, xuddi shu xatoni
    // takrorlaydi.
    const { t } = bot();
    const svc = new ExtraCostTelegramService(t, userRepo(OWNER), proofRepo([]));
    const kb = svc.reasonKeyboard('r1');
    const labels = kb.inline_keyboard.flat().map((b) => b.text);
    expect(labels.some((l) => /orqaga/i.test(l))).toBe(true);
    // Har bir sabab tugmasi aniq matn olib keladi.
    const reasonButtons = kb.inline_keyboard
      .flat()
      .filter((b) => b.callback_data.split(':').length === 4);
    expect(reasonButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('TG16: callback_data Telegram chegarasidan (64 bayt) oshmaydi', async () => {
    // UUID 36 belgi — prefiks va sabab kodi bilan birga chegaraga yaqin.
    const { t } = bot();
    const svc = new ExtraCostTelegramService(t, userRepo(OWNER), proofRepo([]));
    const id = '11111111-2222-4333-8444-555555555555';
    const all = [
      ...svc.decisionKeyboard(id).inline_keyboard.flat(),
      ...svc.reasonKeyboard(id).inline_keyboard.flat(),
    ];
    for (const b of all) {
      expect(Buffer.byteLength(b.callback_data, 'utf8')).toBeLessThanOrEqual(
        64,
      );
    }
  });
});
