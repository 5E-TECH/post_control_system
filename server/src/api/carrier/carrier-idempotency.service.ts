import { HttpException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  CARRIER_ERROR_CODES,
  IDEMPOTENCY_ERROR_CODES,
  carrierHttpError,
} from './carrier-error-codes';

/**
 * Lease — `in_progress` kalit shu muddat ichida boshqa so'rov tomonidan
 * egallab olinmaydi. Elchi `COURIER_OP_LEASE_MS` bilan bir xil (90 s):
 * eng og'ir amal (qisman sotuv + kassa + Telegram) ham bundan ancha tez
 * tugaydi, ya'ni ishlayotgan so'rovni takror "o'g'irlab" ikkinchi marta
 * yuritmaydi; osilib qolgan (jarayon o'lgan) kalit esa 90 s dan keyin
 * qayta ishlatilishi mumkin.
 */
export const CARRIER_IDEMPOTENCY_LEASE_MS = 90_000;

/** Elchi `IDEMPOTENCY_KEY_MISMATCH_MESSAGE` bilan aynan bir xil (422). */
export const IDEMPOTENCY_KEY_MISMATCH_MESSAGE =
  "Idempotency-Key boshqa amal, buyurtma yoki ma'lumot uchun ishlatilgan — yangi kalit yuboring";

/** Elchi `IDEMPOTENCY_IN_PROGRESS_MESSAGE` bilan aynan bir xil (409). */
export const IDEMPOTENCY_IN_PROGRESS_MESSAGE =
  "Takroriy so'rov: bu amal hozir bajarilmoqda — biroz kuting va holatni tekshiring";

/**
 * `acquire` natijasi:
 *   - `acquired`  — kalit shu so'rovniki (yangi yoki yiqilgan/osilgan
 *     kalit qayta olingan): amalni bajarish kerak, keyin `complete`/`fail`;
 *   - `completed` — amal AVVAL bajarilgan: qayta bajarilmaydi, chaqiruvchi
 *     buyurtmani qayta o'qib javob beradi (yoki 409 STALE).
 *
 * `priorAttemptMayHaveRun` — qayta egallangan kalitning avvalgi urinishi
 * pul amalini COMMIT qilgan bo'lishi MUMKINMI:
 *   - lease o'tgan `in_progress` — jarayon o'lgan (deploy/OOM) yoki so'rov
 *     90 s dan ko'p osilgan: commit bo'lib, `complete()` ga yetmagan
 *     bo'lishi mumkin → HA;
 *   - `failed` + 5xx (yoki status yo'q) — xatodan keyin qayta o'qish ham
 *     yiqilgan, natija noma'lum → HA;
 *   - `failed` + 4xx — kontrakt sharti yiqilgan yoki qayta o'qish amal
 *     bajarilmaganini ko'rsatgan → YO'Q.
 * HA bo'lsa chaqiruvchi amalni yuritishdan OLDIN buyurtma allaqachon shu
 * amalning maqsad holatidami — tekshirishi shart (aks holda "waiting emas"
 * pre-checki bajarilgan amalga 400 qaytaradi, kontrakt esa ayni kalit bilan
 * qayta urinish xavfsiz deydi).
 */
export type CarrierIdempotencyLease =
  | {
      kind: 'acquired';
      id: string;
      keyHash: string;
      takeover: boolean;
      priorAttemptMayHaveRun: boolean;
    }
  | { kind: 'completed'; id: string; keyHash: string };

type ExistingKeyRow = {
  id: string;
  binding: string;
  state: string;
  lease_until: string | number | null;
  http_status: string | number | null;
};

/**
 * Avvalgi urinish commit qilgan bo'lishi mumkinmi (`priorAttemptMayHaveRun`
 * izohiga qarang). 4xx — amal yozilmagani aniq bo'lgan holatlar
 * (`CarrierService` faqat shunday holatlarda 4xx bilan `fail` qiladi).
 */
function mayHaveRunBefore(existing: ExistingKeyRow): boolean {
  if (existing.state === 'in_progress') return true;
  const status = Number(existing.http_status);
  return !Number.isInteger(status) || status < 400 || status >= 500;
}

/**
 * Kuryer amali tanasining barmoq izi — Elchi `courierOpFingerprint` ning
 * aynan porti (`apps/order-service/src/order-service.controller.ts`).
 * Kalitlar tartiblanadi (JSON kalit tartibi farqi boshqa tana hisoblanmasin),
 * isbot fayli kalitlari kirmaydi: multipart isbot har urinishda qayta
 * yuklanadi — qonuniy qayta urinish 422 olmasin.
 */
export function carrierOpFingerprint(dto: unknown): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value as Record<string, unknown>)
          .filter(
            (key) => key !== 'proofFileKeys' && key !== 'proofFileKeysVerified',
          )
          .sort()
          .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
      );
    }
    return value ?? null;
  };
  return createHash('sha256')
    .update(JSON.stringify(stable(dto ?? null)))
    .digest('hex')
    .slice(0, 32);
}

/** Mijoz kaliti ochiq saqlanmaydi — faqat sha256 (64 hex). */
export function hashIdempotencyKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** `<amal>:<buyurtma>:<barmoq izi>` — kalit shu uchlikka bog'lanadi. */
export function carrierOpBinding(
  action: string,
  orderId: string,
  dto: unknown,
): string {
  return `${action}:${orderId}:${carrierOpFingerprint(dto)}`.slice(0, 160);
}

/**
 * CARRIER API — `Idempotency-Key` DAFTARI (`carrier_idempotency_key`).
 *
 * NEGA. `POST /carrier/orders/:id/status` pulni yozadi (kuryer va market
 * kassasi). Tashqi tizim tarmoq uzilishi / timeout / 5xx da AYNI so'rovni
 * qayta yuboradi. PCS kuryer amallarining o'z himoyasi bor (sotish faqat
 * `waiting` dan, qatorda lock) — ikkinchi sotuv baribir o'tmaydi. Lekin u
 * takrorga "400 waiting emas" deb javob beradi va kompaniya birinchi urinish
 * BAJARILGANINI bilolmay qoladi. Daftar takrorni aniq ajratadi.
 *
 * Elchi semantikasi (`executeIdempotent` + `tryAcquire`) bilan bir xil:
 *   - yangi kalit → `in_progress` + 90 s lease, amal bajariladi;
 *   - ayni kalit boshqa bog'lanish bilan → 422 `IDEMPOTENCY_KEY_MISMATCH`;
 *   - ayni kalit ishlayotgan (lease tirik) → 409 `IDEMPOTENCY_IN_PROGRESS`;
 *   - `failed` yoki lease o'tgan `in_progress` → qayta egallanadi;
 *   - `completed` → amal QAYTA bajarilmaydi.
 * Elchi javob tanasini keshlaydi; bizga kerak emas — Elchi ham javobni
 * keshdan emas, buyurtmani qayta o'qib quradi, shuning uchun bu yerda faqat
 * holat + bog'lanish saqlanadi.
 *
 * ⚠️ Qatorlar o'chirilmaydi: "eski kalit" (`CARRIER_IDEMPOTENCY_KEY_STALE`)
 * aniqlash `completed` qatorlar saqlanishiga tayanadi.
 */
@Injectable()
export class CarrierIdempotencyService {
  private readonly logger = new Logger(CarrierIdempotencyService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Kalitni ATOMIK egallash.
   *
   * `INSERT … ON CONFLICT DO NOTHING` + `SELECT … FOR UPDATE` bitta qisqa
   * tranzaksiyada: ayni kalit bilan bir vaqtda kelgan ikki so'rovdan
   * ikkinchisining INSERT'i birinchisi commit bo'lguncha kutadi, keyin
   * qatorni `in_progress` holatda ko'rib 409 oladi — amal ikki marta
   * yuritilmaydi. Amalning o'zi bu tranzaksiyadan TASHQARIDA (PCS servislari
   * o'z tranzaksiyasini ochadi) — lock uzoq ushlanmaydi.
   */
  async acquire(params: {
    accountId: string;
    key: string;
    action: string;
    orderId: string;
    binding: string;
    now?: number;
  }): Promise<CarrierIdempotencyLease> {
    const now = params.now ?? Date.now();
    const keyHash = hashIdempotencyKey(params.key);
    const leaseUntil = now + CARRIER_IDEMPOTENCY_LEASE_MS;

    try {
      return await this.dataSource.transaction(async (manager) => {
        const inserted: Array<{ id: string }> = await manager.query(
          `INSERT INTO "carrier_idempotency_key"
             ("id", "created_at", "updated_at", "carrier_account_id",
              "key_hash", "binding", "action", "order_id", "state",
              "lease_until", "http_status")
           VALUES ($1, $2, $2, $3, $4, $5, $6, $7, 'in_progress', $8, NULL)
           ON CONFLICT ("carrier_account_id", "key_hash") DO NOTHING
           RETURNING "id"`,
          [
            randomUUID(),
            now,
            params.accountId,
            keyHash,
            params.binding,
            params.action,
            params.orderId,
            leaseUntil,
          ],
        );
        if (inserted?.[0]?.id) {
          return {
            kind: 'acquired',
            id: String(inserted[0].id),
            keyHash,
            takeover: false,
            priorAttemptMayHaveRun: false,
          } as const;
        }

        const rows: ExistingKeyRow[] = await manager.query(
          `SELECT "id", "binding", "state", "lease_until", "http_status"
             FROM "carrier_idempotency_key"
            WHERE "carrier_account_id" = $1 AND "key_hash" = $2
            FOR UPDATE`,
          [params.accountId, keyHash],
        );
        const existing = rows?.[0];
        if (!existing) {
          // INSERT to'qnashdi-yu qator ko'rinmayapti — kutilmagan holat
          // (qatorlar o'chirilmaydi). Qayta urinish xavfsiz.
          throw new Error(
            'carrier idempotency: conflict row not visible after ON CONFLICT',
          );
        }

        // Bog'lanish birinchi tekshiriladi (Elchi tartibi): boshqa amal /
        // buyurtma / tana bilan kelgan kalit holatidan qat'i nazar 422.
        if (existing.binding !== params.binding) {
          throw carrierHttpError(
            422,
            IDEMPOTENCY_KEY_MISMATCH_MESSAGE,
            IDEMPOTENCY_ERROR_CODES.KEY_MISMATCH,
          );
        }

        if (existing.state === 'completed') {
          return {
            kind: 'completed',
            id: String(existing.id),
            keyHash,
          } as const;
        }

        const leaseAlive =
          existing.state === 'in_progress' &&
          Number(existing.lease_until ?? 0) > now;
        if (leaseAlive) {
          throw carrierHttpError(
            409,
            IDEMPOTENCY_IN_PROGRESS_MESSAGE,
            IDEMPOTENCY_ERROR_CODES.IN_PROGRESS,
          );
        }

        // `failed` yoki lease o'tgan `in_progress` (jarayon o'lgan / so'rov
        // osilgan) — kalitni qayta egallaymiz. Avvalgi urinish aslida commit
        // bo'lgan bo'lishi mumkin: PCS holat guardi (`waiting` talabi) qayta
        // yozishga yo'l qo'ymaydi, `CarrierService` esa
        // `priorAttemptMayHaveRun` bo'yicha buyurtma allaqachon maqsad
        // holatda ekanini amal pre-checklaridan OLDIN tekshiradi va
        // muvaffaqiyat qaytaradi.
        const priorAttemptMayHaveRun = mayHaveRunBefore(existing);
        await manager.query(
          `UPDATE "carrier_idempotency_key"
              SET "state" = 'in_progress', "lease_until" = $1,
                  "http_status" = NULL, "updated_at" = $2
            WHERE "id" = $3`,
          [leaseUntil, now, existing.id],
        );
        return {
          kind: 'acquired',
          id: String(existing.id),
          keyHash,
          takeover: true,
          priorAttemptMayHaveRun,
        } as const;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Daftarni o'qib/yozib bo'lmadi — amal BAJARILMADI. 503: ayni kalit
      // bilan qayta urinish xavfsiz (kontrakt).
      this.logger.error(
        `carrier idempotency acquire failed (account ${params.accountId}, order ${params.orderId}): ${
          (error as Error)?.message ?? String(error)
        }`,
      );
      throw carrierHttpError(
        503,
        "Idempotency-Key daftarini tekshirib bo'lmadi — birozdan keyin ayni Idempotency-Key bilan qayta urining",
        CARRIER_ERROR_CODES.TEMPORARILY_UNAVAILABLE,
      );
    }
  }

  /**
   * Amal bajarildi. Xatoni YUTADI: amal allaqachon commit bo'lgan — mijozga
   * 5xx berib "bajarilmadi" deb aldash mumkin emas. Yozilmay qolsa kalit
   * `in_progress` qoladi va lease o'tgach qayta egallanadi
   * (`priorAttemptMayHaveRun: true`); o'shanda `CarrierService` buyurtma
   * allaqachon maqsad holatda ekanini ko'rib takrorni muvaffaqiyat deb
   * taniydi (PCS holat guardi esa qayta yozishga yo'l qo'ymaydi).
   */
  async complete(id: string, httpStatus = 200): Promise<void> {
    try {
      await this.dataSource.query(
        `UPDATE "carrier_idempotency_key"
            SET "state" = 'completed', "lease_until" = NULL,
                "http_status" = $1, "updated_at" = $2
          WHERE "id" = $3`,
        [httpStatus, Date.now(), id],
      );
    } catch (error) {
      this.logger.warn(
        `carrier idempotency complete(${id}) failed: ${(error as Error)?.message ?? String(error)}`,
      );
    }
  }

  /**
   * Amal bajarilmadi — kalit qayta ishlatilishi mumkin. Faqat `in_progress`
   * qator o'zgaradi: lease o'tib boshqa so'rov kalitni olib, amalni
   * MUVAFFAQIYATLI yakunlagan bo'lsa (`completed`), kechikkan birinchi
   * so'rovning xatosi uni `failed` ga qaytarib yubormasin.
   */
  async fail(id: string, httpStatus: number): Promise<void> {
    try {
      await this.dataSource.query(
        `UPDATE "carrier_idempotency_key"
            SET "state" = 'failed', "lease_until" = NULL,
                "http_status" = $1, "updated_at" = $2
          WHERE "id" = $3 AND "state" = 'in_progress'`,
        [httpStatus, Date.now(), id],
      );
    } catch (error) {
      this.logger.warn(
        `carrier idempotency fail(${id}) failed: ${(error as Error)?.message ?? String(error)}`,
      );
    }
  }
}
