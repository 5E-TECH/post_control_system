import { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '../context/request-context';
import { extractRequestMeta } from '../utils/request-meta.util';

/**
 * Har bir HTTP so'rov boshida request-kontekst do'konini to'ldiradi (IP, UA,
 * qurilma) va qolgan barcha zanjirni (`next()`) shu kontekst ichida ishga
 * tushiradi. Shu tufayli chuqurdagi `ActivityLogService.log()` chaqiruvlari
 * IP/qurilma'ni avtomatik oladi — call-site'larni o'zgartirmasdan.
 *
 * Bootstrap'da `app.use(requestContextMiddleware)` sifatida cookie-parser'dan
 * keyin ulanadi (guard/handler/service — hammasi shu kontekst ichida bajariladi).
 */
export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const meta = extractRequestMeta(req);
  runWithRequestContext(
    {
      ip: meta.ip || undefined,
      user_agent: meta.user_agent || undefined,
      device_id: meta.device_id,
      device_name: meta.device_name,
    },
    () => next(),
  );
}
