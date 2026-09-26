import { muteBotOutbound } from './bot-mute.util';

/**
 * BOTLARNI JIMLATISH QO'RIQCHISI.
 *
 * Bu util lokal ishga tushirishni XAVFSIZ qiladi. Agar u buzilsa, lokal
 * nusxa Telegram'ga xabar yubora boshlaydi — bazadagi `group_id` lar esa
 * haqiqiy guruhlarga ishora qilishi mumkin. Buzilish JIMGINA bo'ladi
 * (hech narsa yiqilmaydi), shuning uchun test shart.
 */

function fakeBot() {
  const original = jest.fn().mockResolvedValue({ message_id: 1 });
  return { bot: { telegram: { callApi: original } } as any, original };
}

describe('muteBotOutbound', () => {
  it('jimlatilgandan keyin HAR QANDAY chaqiruv rad etiladi', async () => {
    const { bot } = fakeBot();
    muteBotOutbound(bot, 'test-bot');

    await expect(bot.telegram.callApi('sendMessage', {})).rejects.toThrow(
      /BOTS_ENABLED=false/,
    );
  });

  /** Xato matni qaysi metod to'silganini aytishi kerak — aks holda tergov qiyin. */
  it('xato matnida metod nomi va yorliq bo\'ladi', async () => {
    const { bot } = fakeBot();
    muteBotOutbound(bot, 'order-bot');

    await expect(
      bot.telegram.callApi('editMessageText', {}),
    ).rejects.toThrow(/editMessageText.*order-bot/s);
  });

  /**
   * ⚠️ Asl `callApi` UMUMAN chaqirilmasligi shart — aks holda so'rov
   * Telegram'ga ketib, jimlatish ma'nosiz bo'lardi.
   */
  it('asl callApi chaqirilmaydi', async () => {
    const { bot, original } = fakeBot();
    muteBotOutbound(bot, 'test-bot');

    await bot.telegram.callApi('sendMessage', {}).catch(() => {});
    expect(original).not.toHaveBeenCalled();
  });

  it('ikki marta jimlatish zararsiz (idempotent)', async () => {
    const { bot } = fakeBot();
    muteBotOutbound(bot, 'test-bot');
    const first = bot.telegram.callApi;
    muteBotOutbound(bot, 'test-bot');

    // Ikkinchi chaqiruv birinchisini o'ramaydi — ayni funksiya qoladi.
    expect(bot.telegram.callApi).toBe(first);
    await expect(bot.telegram.callApi('getMe', {})).rejects.toThrow();
  });

  /** Telegraf ichki tuzilishi o'zgarsa ilova YIQILMASLIGI kerak. */
  it('callApi topilmasa yiqilmaydi', () => {
    expect(() => muteBotOutbound({ telegram: {} } as any, 'x')).not.toThrow();
    expect(() => muteBotOutbound({} as any, 'x')).not.toThrow();
    expect(() => muteBotOutbound(undefined as any, 'x')).not.toThrow();
  });
});

/**
 * ⚠️ PROD XAVFSIZLIGI: env o'zgaruvchisi YO'Q bo'lsa botlar YOQILGAN
 * bo'lishi SHART. Aks holda bu bayroq prodda botlarni jimgina
 * o'chirib qo'yardi va buyurtma oqimi to'xtardi.
 */
describe('config.BOTS_ENABLED — sukut bo\'yicha qiymat', () => {
  const saved = process.env.BOTS_ENABLED;
  afterEach(() => {
    if (saved === undefined) delete process.env.BOTS_ENABLED;
    else process.env.BOTS_ENABLED = saved;
    jest.dontMock('dotenv');
    jest.resetModules();
  });

  const load = () => {
    jest.resetModules();
    /**
     * ⚠️ `dotenv` MOCK QILINADI — busiz bu test MUHITGA BOG'LIQ bo'lardi.
     *
     * `src/config` import paytida `dotenv.config()` chaqiradi, u esa
     * `server/.env` dan MAVJUD BO'LMAGAN kalitni to'ldiradi. Ya'ni
     * yuqoridagi `delete process.env.BOTS_ENABLED` bekor bo'lib,
     * qiymat faylдан QAYTA kelardi.
     *
     * Natijada: `.env` da `BOTS_ENABLED=false` bo'lgan HAR BIR lokal
     * mashinada (`.env.example` aynan shuni yozishni aytadi!) bu
     * qo'riqchi QIZIB ketardi — va eng tabiiy "tuzatish" aynan shu
     * assertion'ni o'chirish bo'lardi. Ya'ni prodda botlarni jimgina
     * o'chishdan saqlaydigan yagona test o'z-o'zini yo'q qilardi.
     *
     * Mock bilan test faqat `process.env` → bayroq mantiqini tekshiradi,
     * `config/index.ts` dagi predikat esa hamon haqiqatan bajariladi.
     */
    jest.doMock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('src/config').default as { BOTS_ENABLED: boolean };
  };

  it("o'zgaruvchi YO'Q bo'lsa YOQILGAN", () => {
    delete process.env.BOTS_ENABLED;
    expect(load().BOTS_ENABLED).toBe(true);
  });

  it("aynan 'false' bo'lsa O'CHIRILGAN", () => {
    process.env.BOTS_ENABLED = 'false';
    expect(load().BOTS_ENABLED).toBe(false);
  });

  /** Noto'g'ri yozilgan qiymat botlarni O'CHIRMASLIGI kerak. */
  it.each(['true', 'FALSE', '0', 'no', ''])(
    "'%s' — YOQILGAN qoladi",
    (v) => {
      process.env.BOTS_ENABLED = v;
      expect(load().BOTS_ENABLED).toBe(true);
    },
  );
});
