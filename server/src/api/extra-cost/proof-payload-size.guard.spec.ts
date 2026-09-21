/// <reference types="jest" />
import { ExecutionContext } from '@nestjs/common';
import { ProofPayloadSizeGuard } from './proof-payload-size.guard';
import { PROOF_MAX_TOTAL_BYTES } from './proof-storage.const';

/**
 * UMUMIY BYUDJET DARVOZASI — multerdan OLDINGI to'siq.
 *
 * ⚠️ NEGA ALOHIDA UNIT TEST, E2E emas. `supertest` multipart so'rovda
 * `Content-Length` ni O'ZI hisoblab qo'yadi va qo'lda o'rnatilganini ustidan
 * yozadi — ya'ni E2E orqali bu guardni ishonchli sinab bo'lmaydi.
 *
 * Guard nimani himoyalaydi: `memoryStorage` bilan 5 ta 25 MB video avval
 * BUTUNLAY xotiraga o'qilib, keyin rad etilardi. Takroriy so'rovlar bilan
 * bu serverni yiqitish yo'li edi.
 */
const ctx = (contentLength?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers:
          contentLength === undefined
            ? {}
            : { 'content-length': contentLength },
      }),
    }),
  }) as unknown as ExecutionContext;

describe('Isbot yuklash — umumiy byudjet darvozasi', () => {
  const guard = new ProofPayloadSizeGuard();

  it('TC1: byudjet ichidagi so‘rov O‘TADI', () => {
    expect(guard.canActivate(ctx(String(PROOF_MAX_TOTAL_BYTES - 1)))).toBe(
      true,
    );
  });

  it('TC2: byudjetdan KATTA so‘rov RAD ETILADI', () => {
    expect(() =>
      guard.canActivate(ctx(String(PROOF_MAX_TOTAL_BYTES * 3))),
    ).toThrow(/umumiy hajmi/);
  });

  it('TC3: multipart ortiqchasi uchun zaxira bor — chegaraga TENG so‘rov o‘tadi', () => {
    // Multipart sarlavhalari fayllar yig'indisidan bir necha KB katta bo'ladi;
    // zaxirasiz qonuniy so'rov chegarada rad etilardi.
    expect(guard.canActivate(ctx(String(PROOF_MAX_TOTAL_BYTES)))).toBe(true);
  });

  it('TC4: `Content-Length` YO‘Q bo‘lsa (chunked) o‘tkaziladi', () => {
    // Bu holatda multer o'z chegaralarini qo'llaydi va servisdagi jami
    // tekshiruv oxirgi devor bo'ladi.
    expect(guard.canActivate(ctx(undefined))).toBe(true);
  });

  it('TC5: buzuq `Content-Length` yiqitmaydi', () => {
    expect(guard.canActivate(ctx('salom'))).toBe(true);
  });
});
