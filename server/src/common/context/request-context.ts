import { AsyncLocalStorage } from 'async_hooks';

/**
 * Har bir HTTP so'rov uchun kontekst — audit-log'ga IP/qurilma'ni AVTOMATIK
 * yozish uchun. Ilova singleton bo'lgani (request-scoped provider yo'q) uchun
 * AsyncLocalStorage to'g'ri mexanizm: so'rov boshida bir marta to'ldiriladi va
 * async/await zanjiri bo'ylab (guard → handler → service → TypeORM tranzaksiya)
 * uzatiladi. `ActivityLogService.log()` shu do'kondan o'qiб, hech bir call-site'ni
 * o'zgartirmasdan har bir logga IP/qurilma qo'shadi.
 *
 * ⚠️ Bot/CRON/webhook kabi HTTP bo'lmagan oqimlarda do'kon BO'SH bo'ladi —
 * bu to'g'ri: bunday amallarda mijoz IP'si yo'q (tizim amali).
 */
export interface RequestContextStore {
  ip?: string;
  user_agent?: string;
  device_id?: string;
  device_name?: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(
  store: RequestContextStore,
  fn: () => T,
): T {
  return storage.run(store, fn);
}

export function getRequestContext(): RequestContextStore | undefined {
  return storage.getStore();
}

/**
 * Joriy so'rov kontekstidan audit metadata'sini (faqat aniqlangan maydonlar)
 * qaytaradi — log metadata'ga qo'shish uchun. HTTP konteksti bo'lmasa {} qaytadi.
 */
export function getRequestAuditMeta(): Record<string, any> {
  const s = storage.getStore();
  if (!s) return {};
  const out: Record<string, any> = {};
  if (s.ip) out.ip = s.ip;
  if (s.user_agent) out.user_agent = s.user_agent;
  if (s.device_id) out.device_id = s.device_id;
  if (s.device_name) out.device_name = s.device_name;
  return out;
}
