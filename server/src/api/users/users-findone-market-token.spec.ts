import { Roles } from 'src/common/enums';
import { UserService } from './users.service';
import { JwtPayload } from 'src/common/utils/types/user.type';

/**
 * QO'RIQCHI — MARKET KARTOCHKASIDAGI «Telegram Token» KARTASI.
 *
 * ── NIMA BO'LGAN EDI ────────────────────────────────────────────────────
 *
 * `ff3a1972` (2026-09-19, prodga 2026-09-21) `market_tg_token` ustuniga
 * `select: false` qo'ydi — to'g'ri xavfsizlik qarori. Lekin kompensatsiya
 * FAQAT `profile()` ga qo'yildi, holbuki admin ko'radigan market
 * kartochkasi (`client/.../user-profile/index.tsx:681`) `findOne()` dan
 * oziqlanadi (`getUserById` -> `GET /user/:id`).
 *
 * Natijada karta 2026-09-21 dan 2026-09-24 gacha JIMGINA yo'qoldi:
 * shart `{user?.market_tg_token && (...)}` falsy bo'ldi, xato
 * ko'rsatilmadi, hech qanday test yiqilmadi. Admin order-botni ishga
 * tushirish uchun tokenni ololmay qoldi.
 *
 * ── BU TEST NIMANI USHLAYDI ─────────────────────────────────────────────
 *
 * Ikki tomonlama: token KERAKLI joyda QAYTADI, va KERAKSIZ joyda
 * QAYTMAYDI. `users-secret-fields.spec.ts` faqat `select: false` ni
 * qo'riqlaydi — u bu buzilishni ushlay OLMAGAN edi.
 */

const TOKEN = 'group_token-abc123';

type RepoMock = {
  findOne: jest.Mock;
  createQueryBuilder: jest.Mock;
};

/**
 * `UserService` o'nlab bog'liqlikka ega, lekin `findOne()` FAQAT
 * `this.userRepo` dan foydalanadi. Shu bois to'liq TestingModule o'rniga
 * prototipdan yengil nusxa olinadi — test tez va mo'rt emas.
 */
function makeService(target: { role: Roles; id: string }) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ market_tg_token: TOKEN }),
  };
  const repo: RepoMock = {
    // `select: false` ni taqlid qiladi: oddiy find tokensiz qator qaytaradi.
    findOne: jest.fn().mockResolvedValue({ ...target, name: 'Test market' }),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
  const svc = Object.create(UserService.prototype) as UserService;
  (svc as unknown as { userRepo: RepoMock }).userRepo = repo;
  return { svc, repo, qb };
}

const body = (res: unknown) =>
  (res as { data?: Record<string, unknown> }).data ?? {};

describe("findOne() — market kartochkasida `market_tg_token`", () => {
  const market = { id: 'm-1', role: Roles.MARKET };

  it.each([Roles.SUPERADMIN, Roles.ADMIN])(
    '%s market kartochkasini ochsa token QAYTADI',
    async (role) => {
      const { svc, qb } = makeService(market);
      const res = await svc.findOne('m-1', { role } as JwtPayload);

      expect(body(res).market_tg_token).toBe(TOKEN);
      // Ustun `select: false` — aniq nomlab tanlangan bo'lishi SHART.
      expect(qb.select).toHaveBeenCalledWith(
        'user.market_tg_token',
        'market_tg_token',
      );
    },
  );

  /**
   * ⚠️ Endpoint guard'i allaqachon SUPERADMIN/ADMIN bilan cheklangan
   * (`users.controller.ts:893`). Bu xizmat ichidagi IKKINCHI qatlam:
   * guard kelajakda bo'shashsa ham token oqib chiqmasin.
   */
  it.each([Roles.OPERATOR, Roles.COURIER, Roles.REGISTRATOR, Roles.MARKET])(
    '%s so\'rasa token QAYTMAYDI (guard bo\'shashsa ham)',
    async (role) => {
      const { svc, repo } = makeService(market);
      const res = await svc.findOne('m-1', { role } as JwtPayload);

      expect(body(res).market_tg_token).toBeUndefined();
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    },
  );

  it('target MARKET bo\'lmasa token umuman qo\'shilmaydi', async () => {
    const { svc, repo } = makeService({ id: 'a-1', role: Roles.ADMIN });
    const res = await svc.findOne('a-1', {
      role: Roles.SUPERADMIN,
    } as JwtPayload);

    expect(body(res).market_tg_token).toBeUndefined();
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('bazada token NULL bo\'lsa xato bermaydi, null qaytaradi', async () => {
    const { svc, qb } = makeService(market);
    qb.getRawOne.mockResolvedValue({ market_tg_token: null });

    const res = await svc.findOne('m-1', {
      role: Roles.SUPERADMIN,
    } as JwtPayload);
    expect(body(res).market_tg_token).toBeNull();
  });
});
