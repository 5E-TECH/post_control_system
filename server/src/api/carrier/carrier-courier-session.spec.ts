/// <reference types="jest" />
import { HttpException } from '@nestjs/common';
import config from 'src/config';
import { Roles, Status } from 'src/common/enums';
import { UserService } from 'src/api/users/users.service';
import {
  CARRIER_COURIER_LOGIN_MESSAGE,
  CARRIER_EXTERNAL_PROVIDER,
} from './carrier-account.service';

/**
 * CARRIER KURYERI JWT SESSIYASIZ — `UserService` darvozalari.
 *
 * NEGA. Tashqi kompaniya faqat `X-Api-Key` bilan ishlaydi. Bog'lashda kuryer
 * paroli tasodifiy qilinadi, lekin stateless JWT bundan o'lmaydi: bog'lashdan
 * OLDIN ochilgan sessiya refresh bilan yashab, `PATCH /user/self` da eski
 * parolsiz yangi parol qo'yib, kuryer ilovasi orqali carrier buyurtmalarini
 * kalit, IP ro'yxati, akkaunt o'chirgichi va adapter pul qoidalarisiz
 * (`extraCost` → EXTERNAL_AUTO, isbotsiz) sotardi. Bu yerda o'sha zanjirning
 * har bir halqasi uziladi; oddiy kuryer xulqi o'zgarmaydi.
 *
 * `users-market-telegram.spec.ts` naqshi: servis `Object.create` bilan,
 * faqat kerakli bog'liqliklar.
 */

const COURIER_ID = '22222222-2222-4222-8222-222222222222';

const courier = (over: Record<string, unknown> = {}) => ({
  id: COURIER_ID,
  name: 'BTS kuryeri',
  phone_number: '+998901112233',
  role: Roles.COURIER,
  status: Status.ACTIVE,
  is_deleted: false,
  external_provider: CARRIER_EXTERNAL_PROVIDER,
  password: '$2b$10$hash',
  ...over,
});

function makeSvc(user: Record<string, unknown> | null) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'addSelect']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getOne = jest.fn().mockResolvedValue(user);
  const userRepo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn().mockResolvedValue(user),
    save: jest.fn(async (u: unknown) => u),
  };
  const activityLog = { log: jest.fn() };
  const bcrypt = {
    compare: jest.fn().mockResolvedValue(true),
    encrypt: jest.fn(async () => '$2b$10$new'),
  };
  const token = {
    generateAccessToken: jest.fn().mockResolvedValue('access'),
    generateRefreshToken: jest.fn().mockResolvedValue('refresh'),
  };
  const jwtService = {
    verify: jest.fn(() => ({
      id: COURIER_ID,
      role: Roles.COURIER,
      status: Status.ACTIVE,
    })),
  };
  const svc = Object.create(UserService.prototype) as UserService;
  Object.assign(svc as unknown as Record<string, unknown>, {
    userRepo,
    activityLog,
    bcrypt,
    token,
    jwtService,
  });
  return { svc, userRepo, activityLog, bcrypt, token };
}

const res = () => ({ clearCookie: jest.fn(), cookie: jest.fn() }) as any;

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return e as HttpException;
  }
  throw new Error('Xato kutilgan edi');
}

describe('Carrier kuryeri — login / refresh / profil darvozalari', () => {
  it('⭐ signin: parol to‘g‘ri bo‘lsa ham token BERILMAYDI, urinish loglanadi', async () => {
    const { svc, token, activityLog } = makeSvc(courier());
    const error = await failure(
      svc.signInUser(
        { phone_number: '+998901112233', password: 'x' } as any,
        res(),
      ),
    );
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe(CARRIER_COURIER_LOGIN_MESSAGE);
    expect(token.generateAccessToken).not.toHaveBeenCalled();
    expect(token.generateRefreshToken).not.toHaveBeenCalled();
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'login_failed',
        metadata: expect.objectContaining({ reason: 'carrier_api_only' }),
      }),
    );
  });

  it('signin: parol noto‘g‘ri — umumiy xabar (raqam carrier’niki ekani bilinmaydi)', async () => {
    const { svc, bcrypt } = makeSvc(courier());
    bcrypt.compare.mockResolvedValueOnce(false);
    const error = await failure(
      svc.signInUser(
        { phone_number: '+998901112233', password: 'x' } as any,
        res(),
      ),
    );
    expect(error.message).toBe('Phone number or password incorrect');
  });

  it('signin: oddiy kuryer — avvalgidek kiradi', async () => {
    // Cookie muddati `.env` dan o'qiladi — test muhitida yo'q.
    const saved = config.REFRESH_TOKEN_TIME;
    config.REFRESH_TOKEN_TIME = '7d';
    try {
      const { svc, token } = makeSvc(courier({ external_provider: null }));
      const out: any = await svc.signInUser(
        { phone_number: '+998901112233', password: 'x' } as any,
        res(),
      );
      expect(out.data.access_token).toBe('access');
      expect(token.generateRefreshToken).toHaveBeenCalled();
    } finally {
      config.REFRESH_TOKEN_TIME = saved;
    }
  });

  it('⭐ refresh: bog‘lashdan oldingi cookie bilan yangi access token BERILMAYDI, cookie tozalanadi', async () => {
    const { svc, token } = makeSvc(courier());
    const response = res();
    const error = await failure(
      svc.refreshToken(
        { cookies: { refreshToken: 'old-cookie' } } as any,
        response,
      ),
    );
    expect(error.getStatus()).toBe(401);
    expect(response.clearCookie).toHaveBeenCalledWith('refreshToken');
    expect(token.generateAccessToken).not.toHaveBeenCalled();
  });

  it('refresh: oddiy kuryer — avvalgidek', async () => {
    const { svc } = makeSvc(courier({ external_provider: null }));
    const out: any = await svc.refreshToken(
      { cookies: { refreshToken: 'c' } } as any,
      res(),
    );
    expect(out.data.access_token).toBe('access');
  });

  it('⭐ self-update: tirik access token bilan eski parolsiz parol qo‘yib bo‘lmaydi (403), hech narsa yozilmaydi', async () => {
    const { svc, userRepo, bcrypt } = makeSvc(courier());
    const error = await failure(
      svc.selfUpdate(
        { id: COURIER_ID, role: Roles.COURIER } as any,
        {
          password: 'known',
        } as any,
      ),
    );
    expect(error.getStatus()).toBe(403);
    expect(bcrypt.encrypt).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('⭐ admin updateCourier: carrier kuryeriga parol — 400; parolsiz o‘zgarish va oddiy kuryer paroli — avvalgidek', async () => {
    const carrier = makeSvc(courier());
    const error = await failure(
      carrier.svc.updateCourier(COURIER_ID, { password: 'known' } as any),
    );
    expect(error.getStatus()).toBe(400);
    expect(carrier.userRepo.save).not.toHaveBeenCalled();

    const rename = makeSvc(courier());
    await rename.svc.updateCourier(COURIER_ID, {
      name: 'BTS [Carrier]',
    } as any);
    expect(rename.userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'BTS [Carrier]' }),
    );

    const plain = makeSvc(courier({ external_provider: null }));
    await plain.svc.updateCourier(COURIER_ID, { password: 'new' } as any);
    expect(plain.userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ password: '$2b$10$new' }),
    );
  });
});
