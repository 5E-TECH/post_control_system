/// <reference types="jest" />
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import {
  CARRIER_INTERNAL_ERROR_MESSAGE,
  CarrierExceptionFilter,
  describeCarrierError,
} from './carrier-exception.filter';
import {
  CARRIER_ERROR_CODES,
  IDEMPOTENCY_ERROR_CODES,
  carrierHttpError,
} from '../carrier-error-codes';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function run(
  exception: unknown,
  opts: { headers?: Record<string, string>; headersSent?: boolean } = {},
) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const json = jest.fn();
  const response = {
    headersSent: !!opts.headersSent,
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    getHeader: jest.fn((k: string) => headers[k]),
    status: jest.fn((_code: number) => ({ json })),
  };
  const request = {
    method: 'POST',
    originalUrl: '/api/v1/carrier/orders/abc/status',
    carrier: { id: 'acc-1', name: 'BTS', courier_user_id: 'c-1' },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as any;
  new CarrierExceptionFilter().catch(exception, host);
  const body = json.mock.calls[0]?.[0];
  const status = response.status.mock.calls[0]?.[0];
  return { body, headers, response, status };
}

/** Global ValidationPipe (`app.service.ts`) aynan shunday 422 tashlaydi. */
const validationPipeError = () =>
  new HttpException(
    {
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: [
        'qr_token should not be empty',
        'property extraCost should not exist',
      ],
      error: "Ma'lumotlar validatsiyadan o'tmadi",
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );

describe('CarrierExceptionFilter', () => {
  let errorLog: jest.SpyInstance;
  let warnLog: jest.SpyInstance;
  beforeEach(() => {
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    warnLog = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('⭐ konvert: { statusCode, message, code, trace_id } + X-Trace-Id sarlavhasi', () => {
    const { body, headers, status } = run(
      carrierHttpError(
        409,
        'Bu Idempotency-Key oldingi urinishga tegishli',
        CARRIER_ERROR_CODES.IDEMPOTENCY_KEY_STALE,
      ),
    );
    expect(status).toBe(409);
    expect(body).toEqual({
      statusCode: 409,
      message: 'Bu Idempotency-Key oldingi urinishga tegishli',
      code: 'CARRIER_IDEMPOTENCY_KEY_STALE',
      trace_id: expect.stringMatching(UUID_RE),
    });
    expect(headers['X-Trace-Id']).toBe(body.trace_id);
  });

  it('har xatoga YANGI trace_id', () => {
    const a = run(new NotFoundException('x')).body.trace_id;
    const b = run(new NotFoundException('x')).body.trace_id;
    expect(a).not.toBe(b);
  });

  it("kodsiz xato — `code` maydoni umuman yo'q", () => {
    const { body } = run(new NotFoundException('Buyurtma topilmadi'));
    expect(body).toEqual({
      statusCode: 404,
      message: 'Buyurtma topilmadi',
      trace_id: expect.any(String),
    });
    expect(body).not.toHaveProperty('code');
  });

  it('⭐ global ValidationPipe 422 → 400, xabarlar birlashtiriladi', () => {
    const { body, status } = run(validationPipeError());
    expect(status).toBe(400);
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe(
      'qr_token should not be empty; property extraCost should not exist',
    );
    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('error');
  });

  it('⭐ 422 FAQAT IDEMPOTENCY_KEY_MISMATCH uchun saqlanadi', () => {
    const mismatch = run(
      carrierHttpError(
        422,
        'Kalit boshqa so‘rov bilan ishlatilgan',
        IDEMPOTENCY_ERROR_CODES.KEY_MISMATCH,
      ),
    );
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.code).toBe('IDEMPOTENCY_KEY_MISMATCH');

    const other = run(
      new HttpException(
        { message: 'boshqa 422' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
    expect(other.status).toBe(400);
    expect(other.body.message).toBe('boshqa 422');
  });

  it("ro'yxatda yo'q `code` javobga chiqmaydi (ichki kod sizmasin)", () => {
    const { body } = run(
      new HttpException(
        { statusCode: 400, message: 'xato', code: '23505' },
        400,
      ),
    );
    expect(body).not.toHaveProperty('code');
  });

  it('⭐ 5xx kodsiz — umumiy matn (xom DB xabari sizmaydi), log’da trace_id + carrier + stack', () => {
    // `catchError` noma'lum xatoni shunday o'raydi.
    const { body, status } = run(
      new InternalServerErrorException(
        'duplicate key value violates unique constraint "IDX_ORDER_NUMBER"',
      ),
    );
    expect(status).toBe(500);
    expect(body.message).toBe(CARRIER_INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toContain('IDX_ORDER_NUMBER');
    const logged = String(errorLog.mock.calls[0][0]);
    expect(logged).toContain(`trace_id=${body.trace_id}`);
    expect(logged).toContain('carrier=acc-1');
    expect(logged).toContain('POST /api/v1/carrier/orders/abc/status');
    expect(logged).toContain('IDX_ORDER_NUMBER');
  });

  it('HTTP bo‘lmagan xato — 500, umumiy matn, stack log’da', () => {
    const err = new TypeError(
      "Cannot read properties of undefined (reading 'id')",
    );
    const { body, status } = run(err);
    expect(status).toBe(500);
    expect(body.message).toBe(CARRIER_INTERNAL_ERROR_MESSAGE);
    expect(errorLog).toHaveBeenCalledWith(expect.any(String), err.stack);
  });

  it('⭐ kodli 503 o‘z xabarini saqlaydi + Retry-After sukuti', () => {
    const { body, headers, status } = run(
      carrierHttpError(
        503,
        "API kalitni tekshirib bo'lmadi — birozdan keyin qayta urining",
        CARRIER_ERROR_CODES.KEY_CHECK_UNAVAILABLE,
      ),
    );
    expect(status).toBe(503);
    expect(body.code).toBe('CARRIER_KEY_CHECK_UNAVAILABLE');
    expect(body.message).toContain("tekshirib bo'lmadi");
    expect(headers['Retry-After']).toBe('5');
  });

  it('kodsiz 503 — umumiy matn, status saqlanadi', () => {
    const { body, status } = run(new ServiceUnavailableException('pg pool'));
    expect(status).toBe(503);
    expect(body.message).toBe(CARRIER_INTERNAL_ERROR_MESSAGE);
  });

  it('⭐ 429: status va throttler qo‘ygan Retry-After saqlanadi, matn o‘zbekcha', () => {
    const { body, headers, status } = run(new ThrottlerException(), {
      headers: { 'Retry-After': '42' },
    });
    expect(status).toBe(429);
    expect(headers['Retry-After']).toBe('42');
    expect(body.message).not.toContain('ThrottlerException');
    expect(warnLog).not.toHaveBeenCalled();
  });

  it("429: Retry-After yo'q bo'lsa — oyna uzunligi (soniya)", () => {
    const { headers } = run(new ThrottlerException());
    expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(1);
  });

  it('⭐ multer: 50 MB dan katta fayl — 413 (kontrakt §3), boshqa multer xatosi — 400', () => {
    // Nest FileInterceptor: LIMIT_FILE_SIZE → PayloadTooLargeException.
    const big = run(new PayloadTooLargeException('File too large'));
    expect(big.status).toBe(413);
    expect(big.body.message).toBe('Isbot fayli 50 MB dan katta');

    const field = run(new BadRequestException('Unexpected field - photo'));
    expect(field.status).toBe(400);
    expect(field.body.message).toMatch(/^Multipart so'rov noto'g'ri: /);

    // Xom MulterError (o'ralmagan holda kelsa ham).
    const rawBig = Object.assign(new Error('File too large'), {
      name: 'MulterError',
      code: 'LIMIT_FILE_SIZE',
    });
    expect(describeCarrierError(rawBig).status).toBe(413);
    const rawOther = Object.assign(new Error('Unexpected field'), {
      name: 'MulterError',
      code: 'LIMIT_UNEXPECTED_FILE',
    });
    expect(describeCarrierError(rawOther).status).toBe(400);
  });

  it('4xx warn darajasida trace_id bilan log qilinadi (kalit/sarlavhalarsiz)', () => {
    const { body } = run(carrierHttpError(401, "X-Api-Key yo'q yoki yaroqsiz"));
    const line = String(warnLog.mock.calls[0][0]);
    expect(line).toContain(`trace_id=${body.trace_id}`);
    expect(line).toContain('401');
    expect(line).not.toMatch(/bpc_/);
  });

  it('javob allaqachon yuborilgan bo‘lsa — qayta yozmaydi', () => {
    const { response } = run(new NotFoundException('x'), { headersSent: true });
    expect(response.status).not.toHaveBeenCalled();
    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it("matnsiz xato — status bo'yicha o'zbekcha sukut", () => {
    expect(describeCarrierError(new HttpException({}, 403)).message).toBe(
      "Ruxsat yo'q",
    );
  });
});
