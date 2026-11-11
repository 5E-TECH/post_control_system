import { HttpException } from '@nestjs/common';
import { Roles, Status } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';

/**
 * CARRIER API — mashina o'qiydigan xato kodlari.
 *
 * ⚠️ Satrlar Elchi bilan AYNAN BIR XIL bo'lishi SHART
 * (Elchi-Backend `libs/common/src/integration/carrier-error-codes.ts` va
 * `libs/common/src/idempotency/idempotency-error-codes.ts`): tashqi kompaniya
 * bitta kod bilan ikkala tizimga ulanadi va `code` bo'yicha qaror qiladi.
 */
export const CARRIER_ERROR_CODES = {
  /** Kalitni tekshirib bo'lmadi (baza xatosi) — 503, qayta urinish mumkin. */
  KEY_CHECK_UNAVAILABLE: 'CARRIER_KEY_CHECK_UNAVAILABLE',
  /** Bog'langan kuryer bloklangan/o'chirilgan — 403. */
  COURIER_INACTIVE: 'CARRIER_COURIER_INACTIVE',
  /** `Idempotency-Key` header yo'q yoki noto'g'ri — 400. */
  IDEMPOTENCY_KEY_REQUIRED: 'CARRIER_IDEMPOTENCY_KEY_REQUIRED',
  /** Kalit avval bajarilgan, lekin buyurtma holati o'shandan beri o'zgargan — 409. */
  IDEMPOTENCY_KEY_STALE: 'CARRIER_IDEMPOTENCY_KEY_STALE',
  /** Vaqtinchalik ichki xato — 503, shu kalit bilan qayta urinish mumkin. */
  TEMPORARILY_UNAVAILABLE: 'CARRIER_TEMPORARILY_UNAVAILABLE',
} as const;

export const IDEMPOTENCY_ERROR_CODES = {
  /** Kalit boshqa buyurtma/tana bilan qayta ishlatildi — 422. */
  KEY_MISMATCH: 'IDEMPOTENCY_KEY_MISMATCH',
  /** Shu kalit bilan so'rov hali bajarilmoqda — 409. */
  IN_PROGRESS: 'IDEMPOTENCY_IN_PROGRESS',
} as const;

export type CarrierErrorCode =
  | (typeof CARRIER_ERROR_CODES)[keyof typeof CARRIER_ERROR_CODES]
  | (typeof IDEMPOTENCY_ERROR_CODES)[keyof typeof IDEMPOTENCY_ERROR_CODES];

/** BeePost carrier kalitlari prefiksi (Elchi'da `elc_`). Kalit — shaffof satr. */
export const CARRIER_KEY_PREFIX = 'bpc_';

/**
 * Kontrakt shaklidagi xato: `{ statusCode, message, code? }`.
 * `trace_id` ni `CarrierExceptionFilter` qo'shadi.
 */
export function carrierHttpError(
  status: number,
  message: string,
  code?: CarrierErrorCode,
): HttpException {
  return new HttpException(
    code
      ? { statusCode: status, message, code }
      : { statusCode: status, message },
    status,
  );
}

/** Guard o'rnatadigan carrier ma'lumoti (`request.carrier`). */
export interface CarrierPrincipal {
  /** `carrier_account.id` */
  id: string;
  name: string;
  courier_user_id: string;
}

/**
 * Mavjud kuryer amallari (`OrderService` / `PostService`) uchun "soxta" JWT
 * foydalanuvchi — xuddi LDG/Elchi webhooklaridagi `elchiActor` naqshi.
 * Shu tufayli egalik tekshiruvi, status mashinasi va kassa yozuvlari
 * o'zgarishsiz ishlaydi.
 */
export function carrierActor(courierUserId: string): JwtPayload {
  return { id: courierUserId, role: Roles.COURIER, status: Status.ACTIVE };
}
