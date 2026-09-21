import { getMetadataArgsStorage } from 'typeorm';
import { UserEntity } from 'src/core/entity/users.entity';

/**
 * MAXFIY MAYDONLAR QAYTIB CHIQMASLIGI UCHUN QO'RIQCHI.
 *
 * ⚠️ NEGA ENTITY DARAJASIDA. Parol hash'i har bir `userRepo.find*`
 * natijasida kelardi va u yerdan `successRes(user)` orqali API javobiga
 * chiqib ketardi — `GET /user`, `GET /user/:id`, `GET /user/logists`,
 * `PATCH /user/self`, `POST /user/operator` va boshqalar. Har bir joyni
 * qo'lda tozalash bir necha marta urinilgan va bug baribir YANGI joyda
 * qaytib paydo bo'lgan.
 *
 * Yechim `select: false` — ORM ustunni SELECT ga umuman qo'shmaydi.
 * Bu test o'sha to'siqni qo'riqlaydi: kimdir `select: false` ni olib
 * tashlasa, 15+ endpoint jimgina oqa boshlaydi va buni hech qanday
 * boshqa test ushlamaydi.
 */
const columnOptions = (prop: keyof UserEntity) =>
  getMetadataArgsStorage().columns.find(
    (c) => c.target === UserEntity && c.propertyName === prop,
  )?.options as { select?: boolean } | undefined;

describe('UserEntity — maxfiy ustunlar SELECT dan chiqarilgan', () => {
  it("`password` ustuni `select: false` bo'lishi SHART", () => {
    expect(columnOptions('password')?.select).toBe(false);
  });

  /**
   * ⚠️ `market_tg_token` — bir martalik operator-qo'shish kaliti:
   * order-botga yuborilsa o'sha marketga YANGI OPERATOR qo'shiladi.
   * Ya'ni bu shunchaki ma'lumot emas, imtiyoz.
   */
  it("`market_tg_token` ustuni `select: false` bo'lishi SHART", () => {
    expect(columnOptions('market_tg_token')?.select).toBe(false);
  });
});
