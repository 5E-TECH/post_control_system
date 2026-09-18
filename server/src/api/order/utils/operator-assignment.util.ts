import { BadRequestException } from '@nestjs/common';
import { Roles, Status } from 'src/common/enums';

/**
 * BUYURTMAGA OPERATOR BIRIKTIRISH QOIDASI — yagona manba.
 *
 * ⚠️ NEGA SOF FUNKSIYA. `operator_id` operator KOMISSIYASINI belgilaydi
 * (`operator_earning`), ya'ni bu pul qarori. Uni `createOrder` ning 250
 * qatorlik tranzaksiyasi ichiga yoyib yuborish o'rniga bitta joyda
 * to'playmiz: shunda har bir qoida alohida sinaladi va boshqa yaratish
 * yo'llari (bot, AI) ham xuddi shu qoidani chaqira oladi.
 */
export interface OperatorCandidate {
  id: string;
  name: string | null;
  status: Status;
  market_id: string | null;
  is_deleted: boolean;
}

export interface AssignmentResult {
  operator_id: string | null;
  /** `null` — chekdagi `operator` matni O'ZGARMAYDI. */
  operator_name: string | null;
  operator_assigned_by: string | null;
  operator_assigned_at: number | null;
  /** `null` — operator hali qabul qilmagan. */
  operator_accepted_at: number | null;
}

export function resolveOperatorAssignment(input: {
  creatorId: string;
  creatorRole: Roles;
  /** Buyurtma tegishli market (operator ham SHU marketniki bo'lishi shart). */
  marketId: string;
  requestedOperatorId?: string | null;
  /** Bazadan topilgan nomzod (topilmasa `null`). */
  candidate: OperatorCandidate | null;
  now: number;
}): AssignmentResult {
  const {
    creatorId,
    creatorRole,
    marketId,
    requestedOperatorId,
    candidate,
    now,
  } = input;

  // ── 1. Operator ANIQ tanlangan ──────────────────────────────────────
  if (requestedOperatorId) {
    /**
     * ⚠️ IDOR to'sig'i. Tanlangan ID boshqa marketning operatori bo'lsa,
     * sotuvdan keyin unga komissiya yozilardi — ya'ni bu shunchaki
     * ma'lumot emas, pul oqishi. `is_deleted` ham shu yerda to'siladi:
     * ishdan bo'shagan operator yangi buyurtmadan pul olmasligi kerak.
     */
    if (!candidate || candidate.is_deleted || candidate.market_id !== marketId) {
      throw new BadRequestException(
        "Tanlangan operator bu marketga tegishli emas yoki o'chirilgan",
      );
    }
    if (candidate.status === Status.INACTIVE) {
      throw new BadRequestException(
        "Tanlangan operator bloklangan — biriktirib bo'lmaydi",
      );
    }
    return {
      operator_id: candidate.id,
      operator_name: candidate.name ?? null,
      operator_assigned_by: creatorId,
      operator_assigned_at: now,
      // O'ZINI tanlagan operator uchun qabul qilish bosqichi ortiqcha.
      operator_accepted_at: candidate.id === creatorId ? now : null,
    };
  }

  // ── 2. Tanlanmadi, lekin yaratuvchining o'zi OPERATOR ────────────────
  // Eski xatti-harakat 1:1 saqlanadi (`order.service.ts` dagi avvalgi
  // `user.role === OPERATOR ? user.id : null` shartining o'rni).
  if (creatorRole === Roles.OPERATOR) {
    return {
      operator_id: creatorId,
      operator_name: null,
      operator_assigned_by: creatorId,
      operator_assigned_at: now,
      operator_accepted_at: now,
    };
  }

  // ── 3. Market operator qo'shmagan yoki tanlamadi ─────────────────────
  // Bo'sh qoladi — talab aynan shu: majburlash YO'Q.
  return {
    operator_id: null,
    operator_name: null,
    operator_assigned_by: null,
    operator_assigned_at: null,
    operator_accepted_at: null,
  };
}
