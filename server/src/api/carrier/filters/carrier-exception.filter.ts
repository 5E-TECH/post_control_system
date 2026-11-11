import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CARRIER_ERROR_CODES,
  CarrierPrincipal,
  IDEMPOTENCY_ERROR_CODES,
} from '../carrier-error-codes';
import { carrierThrottleTtlMs } from '../guards/carrier-throttler.guard';

/**
 * 5xx (kodsiz) va kutilmagan xatoda mijozga chiqadigan YAGONA matn.
 * Ichki tafsilot (SQL, stack, `catchError` dagi xom xabar) faqat log'da —
 * u `trace_id` bo'yicha topiladi.
 */
export const CARRIER_INTERNAL_ERROR_MESSAGE =
  "Ichki xato — birozdan keyin ayni Idempotency-Key bilan qayta urining. Takrorlansa trace_id bilan BeePost'ga murojaat qiling";

/** Javobga chiqishi mumkin bo'lgan `code` lar — YOPIQ ro'yxat (Elchi naqshi). */
const PUBLIC_CODES: ReadonlySet<string> = new Set<string>([
  ...Object.values(CARRIER_ERROR_CODES),
  ...Object.values(IDEMPOTENCY_ERROR_CODES),
]);

/** HTTP holatlari — `getStatus()` son qaytaradi, enum bilan solishtirilmaydi. */
const STATUS = {
  BAD_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/** `Retry-After` sarlavhasi bo'lmasa (soniya): 503 — qisqa kutish. */
const DEFAULT_RETRY_AFTER_503_SECONDS = 5;

const DEFAULT_MESSAGES: Readonly<Record<number, string>> = {
  400: "So'rov noto'g'ri",
  401: "X-Api-Key yo'q yoki yaroqsiz",
  403: "Ruxsat yo'q",
  404: 'Topilmadi',
  409: 'Ziddiyat',
  413: 'Isbot fayli 50 MB dan katta',
  429: "So'rovlar chegarasidan oshdi — Retry-After soniyadan keyin qayta urining",
};

/** `@nestjs/throttler` ning inglizcha sukut matni — o'zbekchaga almashtiriladi. */
const THROTTLER_DEFAULT_MESSAGE = 'ThrottlerException: Too Many Requests';

interface CarrierErrorShape {
  status: number;
  message: string;
  code?: string;
  /** Faqat log uchun (mijozga chiqmaydi). */
  internal?: string;
}

interface FilterRequest {
  method?: string;
  originalUrl?: string;
  url?: string;
  carrier?: CarrierPrincipal;
}

interface FilterResponse {
  headersSent?: boolean;
  setHeader(name: string, value: string): unknown;
  getHeader(name: string): unknown;
  status(code: number): { json(body: unknown): unknown };
}

/**
 * CARRIER API XATO KONVERTI — `{ statusCode, message, code?, trace_id }`
 * (kontrakt CARRIER_API.md §3). Faqat `CarrierPublicController` da
 * `@UseFilters` bilan ulanadi; admin va boshqa API'lar global
 * `AllExceptionsFilter` da qoladi.
 *
 * NEGA ALOHIDA FILTR:
 *   - global filtr `code` ni TASHLAB YUBORADI va `trace_id` yo'q, kompaniya
 *     esa qarorni `statusCode` + `code` bo'yicha qabul qiladi;
 *   - global ValidationPipe maydon xatosini 422 bilan beradi, kontraktda
 *     422 FAQAT `IDEMPOTENCY_KEY_MISMATCH` (yangi kalit kerak). Bu yerda
 *     boshqa har qanday 422 → 400 (tuzatib yuborish kerak);
 *   - 5xx da xom ichki matn (`catchError` DB xabarini 500 ga o'raydi)
 *     tashqi kompaniyaga sizmasin.
 *
 * `trace_id` har xatoga yangi UUID, javob tanasida va `X-Trace-Id`
 * sarlavhasida; log'da ham shu id — kompaniya murojaat qilsa aniq so'rov
 * topiladi.
 *
 * ⚠️ Filtr guard xatolarini ham ushlaydi (Nest controller filtri guard,
 * pipe va handler'ni qamraydi), LEKIN noma'lum route va body-parser xatolari
 * controllerga yetmaydi — ular global filtr shaklida qaytadi (hujjatlangan).
 */
@Catch()
export class CarrierExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('CarrierApi');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FilterResponse>();
    const request = ctx.getRequest<FilterRequest>();
    const traceId = randomUUID();

    const error = describeCarrierError(exception);
    this.log(error, exception, request, traceId);

    if (response.headersSent) {
      return;
    }
    response.setHeader('X-Trace-Id', traceId);
    if (error.status === STATUS.TOO_MANY_REQUESTS) {
      setDefaultHeader(
        response,
        'Retry-After',
        String(Math.max(1, Math.ceil(carrierThrottleTtlMs() / 1000))),
      );
    } else if (error.status === STATUS.SERVICE_UNAVAILABLE) {
      setDefaultHeader(
        response,
        'Retry-After',
        String(DEFAULT_RETRY_AFTER_503_SECONDS),
      );
    }

    response.status(error.status).json({
      statusCode: error.status,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      trace_id: traceId,
    });
  }

  private log(
    error: CarrierErrorShape,
    exception: unknown,
    request: FilterRequest,
    traceId: string,
  ): void {
    const where = `${request?.method ?? '-'} ${
      request?.originalUrl ?? request?.url ?? '-'
    }`;
    const carrierId = request?.carrier?.id ?? '-';
    const line =
      `[trace_id=${traceId}] ${error.status}${error.code ? ` ${error.code}` : ''} ` +
      `${where} carrier=${carrierId} — ${error.internal ?? error.message}`;
    if (error.status >= 500) {
      this.logger.error(
        line,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (error.status === STATUS.TOO_MANY_REQUESTS) {
      // Limitdan oshgan mijoz minutiga yuzlab qator yozdirmasin.
      this.logger.debug(line);
    } else {
      this.logger.warn(line);
    }
  }
}

/**
 * Istalgan xatoni kontrakt shakliga keltiradi (sof funksiya — test qilinadi).
 */
export function describeCarrierError(exception: unknown): CarrierErrorShape {
  if (exception instanceof HttpException) {
    return describeHttpException(exception);
  }

  // Xom multer xatosi (Nest `FileInterceptor` odatda o'zi HttpException ga
  // o'raydi, lekin boshqa yo'l bilan kelsa ham kontrakt saqlansin).
  const multer = multerCode(exception);
  if (multer) {
    if (multer === 'LIMIT_FILE_SIZE') {
      return {
        status: STATUS.PAYLOAD_TOO_LARGE,
        message: DEFAULT_MESSAGES[413],
        internal: errorText(exception),
      };
    }
    return {
      status: STATUS.BAD_REQUEST,
      message: `Multipart so'rov noto'g'ri: ${errorText(exception)}`,
    };
  }

  return {
    status: STATUS.INTERNAL_SERVER_ERROR,
    message: CARRIER_INTERNAL_ERROR_MESSAGE,
    internal: errorText(exception),
  };
}

function describeHttpException(exception: HttpException): CarrierErrorShape {
  let status: number = exception.getStatus();
  const body = exception.getResponse();
  const record =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : null;

  const rawMessage = record ? record.message : body;
  let message = Array.isArray(rawMessage)
    ? rawMessage
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
        .join('; ')
    : typeof rawMessage === 'string'
      ? rawMessage.trim()
      : '';
  const rawCode = record?.code;
  let code =
    typeof rawCode === 'string' && PUBLIC_CODES.has(rawCode)
      ? rawCode
      : undefined;
  const internal = message || undefined;

  // ── 422 → 400 ─────────────────────────────────────────────────────────
  // Kontraktda 422 FAQAT `IDEMPOTENCY_KEY_MISMATCH`. Global ValidationPipe
  // (`app.service.ts`, `error: "Ma'lumotlar validatsiyadan o'tmadi"`) va
  // har qanday boshqa 422 — maydon xatosi, ya'ni 400.
  if (
    status === STATUS.UNPROCESSABLE_ENTITY &&
    code !== IDEMPOTENCY_ERROR_CODES.KEY_MISMATCH
  ) {
    status = STATUS.BAD_REQUEST;
    code = undefined;
  }

  // ── 5xx ───────────────────────────────────────────────────────────────
  // Kodli 503 (`CARRIER_KEY_CHECK_UNAVAILABLE`, `CARRIER_TEMPORARILY_
  // UNAVAILABLE`) — biz yozgan xabar, saqlanadi. Qolgani — umumiy matn.
  if (status >= 500) {
    if (!code || !message) {
      return {
        status,
        message: CARRIER_INTERNAL_ERROR_MESSAGE,
        code,
        internal,
      };
    }
    return { status, message, code };
  }

  // ── 413: multer `LIMIT_FILE_SIZE` (Nest → PayloadTooLargeException) ──
  // Kontrakt §3: "413 — isbot fayli 50 MB dan katta".
  if (status === STATUS.PAYLOAD_TOO_LARGE) {
    return { status, message: DEFAULT_MESSAGES[413], code, internal };
  }

  // ── 429: throttler sukut matni inglizcha ──
  if (
    status === STATUS.TOO_MANY_REQUESTS &&
    (!message || message === THROTTLER_DEFAULT_MESSAGE)
  ) {
    message = DEFAULT_MESSAGES[429];
  }

  // ── multer 400 (`Unexpected field - proof`, `Multipart: …`) ──
  if (status === STATUS.BAD_REQUEST && isMulterMessage(message)) {
    message = `Multipart so'rov noto'g'ri: ${message}`;
  }

  if (!message) {
    message = DEFAULT_MESSAGES[status] ?? "So'rovni bajarib bo'lmadi";
  }
  return { status, message, code };
}

const MULTER_MESSAGES = [
  'Unexpected field',
  'Too many files',
  'Too many fields',
  'Too many parts',
  'Field name too long',
  'Field value too long',
  'Field name missing',
  'Multipart:',
];

function isMulterMessage(message: string): boolean {
  return MULTER_MESSAGES.some((prefix) => message.startsWith(prefix));
}

function multerCode(exception: unknown): string | null {
  if (
    typeof exception === 'object' &&
    exception !== null &&
    (exception as { name?: unknown }).name === 'MulterError'
  ) {
    const code = (exception as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'UNKNOWN';
  }
  return null;
}

function errorText(exception: unknown): string {
  if (exception instanceof Error) return exception.message;
  if (typeof exception === 'string') return exception;
  try {
    return JSON.stringify(exception);
  } catch {
    return String(exception);
  }
}

function setDefaultHeader(
  response: FilterResponse,
  name: string,
  value: string,
): void {
  const existing =
    typeof response.getHeader === 'function'
      ? response.getHeader(name)
      : undefined;
  if (existing === undefined || existing === null || existing === '') {
    response.setHeader(name, value);
  }
}
