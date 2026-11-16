import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { CarrierPrincipal } from './carrier-error-codes';
import { CarrierOrderStatus } from './dto/carrier-public.dto';

/** Gate o'qiydigan so'rov qismi (Express `req`). */
export interface CarrierRollbackGateRequest {
  body?: unknown;
  carrier?: Pick<CarrierPrincipal, 'rollback_enabled'>;
}

/**
 * Akkauntga rollback ruxsat etilmagan bo'lsa, `status: "rollback"` ni
 * tanadan OLIB TASHLAYDI — keyin global ValidationPipe uni boshqa har
 * qanday noma'lum qiymat (`sould`, `delivered`) bilan AYNAN bir xil rad
 * etadi. Rad etildi-yo'qligini qaytaradi (test va log uchun).
 *
 * NEGA TANADAN OLIB TASHLASH (alohida 400 otish emas). Kontrakt talabi:
 * o'chiq akkaunt `rollback` uchun noma'lum qiymat oladigan javobning
 * O'ZINI olsin — status kodi, xabar, `code` yo'qligi, hatto boshqa
 * maydon xatolari bilan birlashgan xabar ham (`status …; comment must be
 * shorter …`). Buni faqat AYNI ValidationPipe'ning o'zi kafolatlaydi:
 * interceptor pipe'dan oldin ishlaydi, `status` qiymati yo'qolgach pipe
 * uni `@IsIn` bilan noma'lum deb topadi (xabarda qiymatning o'zi
 * chiqmaydi — `CARRIER_STATUS_INVALID_MESSAGE`). Alohida 400 bo'lsa
 * birlashgan xabarlar farq qilib, `rollback` "taniladigan" qiymat ekani
 * bilinib qolardi.
 *
 * Hech qanday yon ta'sir yo'q: pipe'dan keyingi hamma narsa (UUID va
 * `Idempotency-Key` tekshiruvi, egalik, idempotentlik daftari, PCS amali,
 * kassa) umuman ishga tushmaydi — xuddi noma'lum statusdagidek.
 *
 * Fail-closed: `request.carrier` yo'q yoki bayroq aniq `true` emas — o'chiq.
 */
export function stripDisabledRollback(
  request: CarrierRollbackGateRequest | undefined,
): boolean {
  const body = request?.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  if (record.status !== CarrierOrderStatus.ROLLBACK) return false;
  if (request?.carrier?.rollback_enabled === true) return false;
  // `undefined` — maydon "yuborilmagan"dek: `@IsIn` uni noma'lum qiymat
  // kabi rad etadi, `ValidateIf(status === …)` shartlari ham bir xil.
  delete record.status;
  return true;
}

/**
 * YASHIRIN ROLLBACK DARVOZASI — `POST /carrier/orders/:id/status`.
 *
 * ⚠️ TARTIB: `@UseInterceptors(FileInterceptor('proof'), CarrierRollbackGateInterceptor)`
 * — multipart tanasini multer `FileInterceptor` ichida to'ldiradi, shuning
 * uchun gate undan KEYIN turadi. Guard'lar (`request.carrier`) undan oldin
 * ishlaydi, ValidationPipe — keyin.
 *
 * Servisda ham zaxira tekshiruv bor (`CarrierService.updateStatus`
 * boshida, egalik va idempotentlikdan OLDIN) — boshqa yo'l bilan kelgan
 * chaqiruv uchun ham fail-closed.
 */
@Injectable()
export class CarrierRollbackGateInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    stripDisabledRollback(
      context.switchToHttp().getRequest<CarrierRollbackGateRequest>(),
    );
    return next.handle();
  }
}
