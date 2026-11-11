import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiGatewayTimeoutResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiSecurity,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { successRes } from 'src/infrastructure/lib/response';
import {
  CARRIER_ERROR_CODES,
  CarrierPrincipal,
  carrierHttpError,
} from './carrier-error-codes';
import {
  CARRIER_PROOF_MULTER_MAX_BYTES,
  CarrierService,
  NOT_YOURS_MESSAGE,
} from './carrier.service';
import { CarrierApiKeyGuard } from './guards/carrier-api-key.guard';
import { CarrierIpThrottlerGuard } from './guards/carrier-ip-throttler.guard';
import {
  CARRIER_THROTTLE,
  CarrierThrottlerGuard,
} from './guards/carrier-throttler.guard';
import { CarrierExceptionFilter } from './filters/carrier-exception.filter';
import {
  CARRIER_UUID_RE,
  CarrierCashboxQueryDto,
  CarrierCashboxResponseDto,
  CarrierErrorResponseDto,
  CarrierOrderListQueryDto,
  CarrierOrderListResponseDto,
  CarrierOrderStatusRequestDto,
  CarrierPingResponseDto,
  CarrierReturnRequestDto,
  CarrierReturnResponseDto,
  CarrierScanRequestDto,
  CarrierScanResponseDto,
  CarrierStatusResponseDto,
} from './dto/carrier-public.dto';

/**
 * Swagger xavfsizlik sxemasi nomi — Elchi `CARRIER_API_KEY_SCHEME` bilan bir
 * xil (`X-Api-Key`). Sxemaning o'zi carrier Swagger hujjatida e'lon qilinadi.
 */
const CARRIER_API_KEY_SCHEME = 'carrier-api-key';

/** Elchi `readOrderCreateIdempotencyKey` chegarasi bilan bir xil. */
export const CARRIER_IDEMPOTENCY_KEY_MAX = 255;

type CarrierRequest = {
  carrier: CarrierPrincipal;
  headers?: Record<string, unknown>;
};

/**
 * Buyurtma id — UUID; aks holda 400 (kontrakt: noto'g'ri id — 400, 404/422
 * emas). Kichik harfga keltiriladi — idempotency bog'lanishi registrga
 * bog'liq bo'lmasin.
 */
export function parseCarrierOrderId(raw: unknown): string {
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!CARRIER_UUID_RE.test(id)) {
    throw new BadRequestException("Buyurtma id noto'g'ri");
  }
  return id.toLowerCase();
}

/**
 * `Idempotency-Key` MAJBURIY (pul amali, mashina mijozi qayta urinadi).
 * Kalitsiz qayta urinish birinchi (commit bo'lgan) amaldan keyin
 * "waiting emas" xatosini olib, natija noaniq qolardi (Elchi tajribasi).
 */
export function readCarrierIdempotencyKey(
  headers: Record<string, unknown> | undefined,
): string {
  const raw: unknown = headers?.['idempotency-key'];
  const value = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  const key = typeof value === 'string' ? value.trim() : '';
  if (!key) {
    throw carrierHttpError(
      400,
      'Idempotency-Key sarlavhasi majburiy (har yangi urinish uchun yangi UUID)',
      CARRIER_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
    );
  }
  if (key.length > CARRIER_IDEMPOTENCY_KEY_MAX) {
    throw carrierHttpError(
      400,
      `Idempotency-Key ${CARRIER_IDEMPOTENCY_KEY_MAX} belgidan oshmasligi kerak`,
      CARRIER_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
    );
  }
  return key;
}

/**
 * CARRIER API — tashqi yetkazuvchi kompaniya uchun (`X-Api-Key`, JWT emas).
 * Base URL: `https://<beepost-domain>/api/v1` → `/api/v1/carrier/*`.
 *
 * Kompaniya BeePost'da BITTA KURYER akkaunti sifatida ishlaydi; har bir amal
 * shu kuryer nomidan mavjud kuryer amallariga yo'naltiriladi (`CarrierService`).
 * Marshrutlar, maydonlar, javob shakllari va xato kodlari Elchi
 * (`apps/api-gateway/src/carrier-gateway.controller.ts`) bilan AYNAN bir xil —
 * kompaniya bitta integratsiya yozadi. Metod nomlari ham Elchi bilan bir xil
 * (OpenAPI `operationId` mos kelishi uchun).
 *
 * Kontrakt: `CARRIER_API.md` (+ "BeePost profili" ilovasi).
 *
 * ⚠️ `@UseFilters(CarrierExceptionFilter)` — FAQAT shu controller:
 * kontrakt xato shakli (`code`, `trace_id`, validatsiya 400) boshqa PCS
 * endpointlariga tegmaydi.
 */
@ApiTags('Carrier')
@ApiSecurity(CARRIER_API_KEY_SCHEME)
@ApiExtraModels(CarrierOrderStatusRequestDto)
@ApiUnauthorizedResponse({
  description: 'X-Api-Key yo‘q yoki yaroqsiz',
  type: CarrierErrorResponseDto,
})
@ApiForbiddenResponse({
  description:
    'Akkaunt yoki bog‘langan kurier faol emas (code CARRIER_COURIER_INACTIVE), yoki IP ruxsat etilmagan',
  type: CarrierErrorResponseDto,
})
@ApiTooManyRequestsResponse({
  description:
    'Limit: akkaunt uchun daqiqasiga 120 so‘rov (barcha endpoint); kalit tekshiruvidan oldin bitta IP’dan daqiqasiga 600 so‘rov',
  type: CarrierErrorResponseDto,
})
@ApiServiceUnavailableResponse({
  description:
    'Vaqtinchalik xato (CARRIER_KEY_CHECK_UNAVAILABLE / CARRIER_TEMPORARILY_UNAVAILABLE) — ayni Idempotency-Key bilan qayta urining',
  type: CarrierErrorResponseDto,
})
@ApiGatewayTimeoutResponse({
  description:
    'Server vaqtida javob bermadi — ayni Idempotency-Key bilan qayta urining',
  type: CarrierErrorResponseDto,
})
// Per-carrier rate limit — qiymat HAR SO'ROVDA config'dan (`@Throttle`
// resolvable); sanash kaliti — akkaunt: bitta kompaniyaning barcha
// endpointlari bitta chelakda (Elchi bilan bir xil, sukut 120/daqiqa).
@Throttle(CARRIER_THROTTLE)
// Tartib muhim: (1) kanonik yo'l + IP bo'yicha limit — kalitdan OLDIN
// (kalitsiz oqim ham 429 oladi, bazaga bormaydi); (2) kalit
// (`request.carrier`); (3) limit akkaunt bo'yicha.
@UseGuards(CarrierIpThrottlerGuard, CarrierApiKeyGuard, CarrierThrottlerGuard)
@UseFilters(CarrierExceptionFilter)
@Controller('carrier')
export class CarrierPublicController {
  constructor(private readonly carrierService: CarrierService) {}

  @Get('ping')
  @ApiOperation({
    summary: 'Kalitni tekshirish',
    description:
      'Ulanishni sinash uchun. Kalit to‘g‘ri bo‘lsa akkaunt nomini qaytaradi.',
  })
  @ApiOkResponse({ type: CarrierPingResponseDto })
  ping(@Req() req: CarrierRequest) {
    return successRes(
      {
        authenticated: true,
        carrier: { id: req.carrier.id, name: req.carrier.name },
      },
      200,
      'ok',
    );
  }

  /**
   * POSILKANI SKANERLASH. Faqat shu kompaniyaga biriktirilgan buyurtma
   * ko'rinadi; `on the road` bo'lsa shu skanda qabul qilinadi (`waiting`).
   */
  @Post('scan')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Posilka QR skani',
    description:
      'QR bo‘yicha buyurtma ma’lumotini qaytaradi. Posilka yo‘lda (`on the road`) bo‘lsa, ' +
      'shu skanda sizga qabul qilinadi (`waiting`, `received: true`) — sotish va bekor ' +
      'qilish faqat shundan keyin mumkin. Qayta skanerlash xavfsiz. Viloyat/tuman — SOATO kodi bilan.',
  })
  @ApiBody({ type: CarrierScanRequestDto })
  @ApiOkResponse({ type: CarrierScanResponseDto })
  @ApiBadRequestResponse({
    description: 'qr_token bo‘sh yoki 255 belgidan uzun',
    type: CarrierErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: NOT_YOURS_MESSAGE,
    type: CarrierErrorResponseDto,
  })
  scan(@Body() dto: CarrierScanRequestDto, @Req() req: CarrierRequest) {
    return this.carrierService.scan(req.carrier, dto.qr_token);
  }

  /**
   * BUYURTMA HOLATI — mavjud kuryer amallariga yo'naltiriladi. Pul oqimi
   * oddiy kuryer sotuvi bilan AYNAN bir xil (FOR_COURIER kassa). Ixtiyoriy
   * multipart `proof` — tekshiriladi, lekin saqlanmaydi (BeePost profili).
   */
  @Post('orders/:id/status')
  @HttpCode(200)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'MAJBURIY (≤255 belgi). Har YANGI urinish (niyat) uchun YANGI kalit (masalan UUID). ' +
      'Ayni kalitni faqat shu so‘rovni qayta yuborishda ishlating (javob kelmadi, 409/429/5xx/504). ' +
      'Ayni kalit boshqa amal/buyurtma/tana bilan → 422; eski urinish kaliti → 409 CARRIER_IDEMPOTENCY_KEY_STALE.',
  })
  @ApiOperation({
    summary: 'Yetkazish natijasi: sold | partly_sold | cancelled | rollback',
    description:
      '`sold`, `partly_sold`, `cancelled` — faqat `waiting` holatida (avval `/carrier/scan`). ' +
      '`partly_sold` da `items` buyurtmaning HAR BIR qatorini va undan sotilgan donani o‘z ichiga ' +
      'oladi; `total_price` — mijoz olgan tovarlar qiymati. ' +
      '`rollback` — faqat `sold` yoki `cancelled` holatidagi buyurtmani `waiting` ga qaytaradi ' +
      '(`paid`/`partly_paid` — BeePost operatori). ' +
      'Isbot — `multipart/form-data` bilan `proof` fayli: rasm jpeg/png/webp ' +
      'yoki pdf ≤10 MB, video mp4/mov/webm ≤50 MB. Javobda yangilangan buyurtma ' +
      '(`refreshed: false` — holat qabul qilingan, buyurtmani keyinroq o‘qing).',
  })
  @ApiParam({
    name: 'id',
    description: 'Buyurtma id (scan javobidagi data.order.id, UUID)',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    // JSON — `CarrierOrderStatusRequestDto`; multipart'da qo'shimcha `proof`
    // (carrier Swagger hujjati content turlari bo'yicha ajratadi).
    schema: {
      allOf: [
        { $ref: getSchemaPath(CarrierOrderStatusRequestDto) },
        {
          type: 'object',
          properties: {
            proof: {
              type: 'string',
              format: 'binary',
              description: 'Ixtiyoriy isbot fayli (faqat multipart)',
            },
          },
        },
      ],
    },
  })
  @ApiOkResponse({ type: CarrierStatusResponseDto })
  @ApiBadRequestResponse({
    description:
      'Maydon xato, Idempotency-Key yo‘q, isbot fayli mos emas yoki buyurtma bu amal uchun mos holatda emas',
    type: CarrierErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: NOT_YOURS_MESSAGE,
    type: CarrierErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Ayni kalit bilan so‘rov hali bajarilmoqda (biroz kutib qayta urining) yoki kalit eski urinishga tegishli (CARRIER_IDEMPOTENCY_KEY_STALE — yangi kalit)',
    type: CarrierErrorResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Shu Idempotency-Key boshqa amal/buyurtma/tana bilan ishlatilgan',
    type: CarrierErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: 'Isbot fayli 50 MB dan katta',
    type: CarrierErrorResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('proof', {
      // Fayl saqlanmaydi — faqat tur/hajm tekshiriladi, shuning uchun diskka
      // yozilmaydi. Hajm chegarasi multer'da: 50 MB dan kattasi xotiraga
      // to'liq o'qilmaydi.
      storage: memoryStorage(),
      limits: { fileSize: CARRIER_PROOF_MULTER_MAX_BYTES, files: 1 },
    }),
  )
  updateStatus(
    @Param('id') rawId: string,
    @Body() dto: CarrierOrderStatusRequestDto,
    @UploadedFile() proof: Express.Multer.File | undefined,
    @Req() req: CarrierRequest,
  ) {
    const id = parseCarrierOrderId(rawId);
    const idempotencyKey = readCarrierIdempotencyKey(req.headers);
    return this.carrierService.updateStatus(
      req.carrier,
      id,
      dto,
      idempotencyKey,
      proof ?? null,
    );
  }

  /**
   * BEKOR QILINGAN POSILKALARNI QAYTARISH — kuryerning qaytarish pochtasi
   * (`cancelled (sent)`). Takroriy so'rov xavfsiz: o'sha `post_id` qaytadi.
   */
  @Post('returns')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Bekor qilingan posilkalarni BeePost’ga qaytarish',
    description:
      'Sizda turgan `cancelled` holatidagi posilkalar (qisman sotuvdan ajralgan qism ham) uchun ' +
      'qaytarish pochtasi ochiladi — holati `cancelled (sent)`. Posilkalarni BeePost’ga ' +
      'topshirasiz, markaz pochtani qabul qiladi. Takroriy so‘rov xavfsiz.',
  })
  @ApiBody({ type: CarrierReturnRequestDto })
  @ApiOkResponse({ type: CarrierReturnResponseDto })
  @ApiBadRequestResponse({
    description: 'Ro‘yxatda `cancelled` holatida bo‘lmagan posilka bor',
    type: CarrierErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: `${NOT_YOURS_MESSAGE} (id’lar xabarda)`,
    type: CarrierErrorResponseDto,
  })
  returns(@Body() dto: CarrierReturnRequestDto, @Req() req: CarrierRequest) {
    return this.carrierService.createReturns(req.carrier, dto.order_ids);
  }

  /** Shu kompaniyadagi buyurtmalar (solishtirish uchun). */
  @Get('orders')
  @ApiOperation({
    summary: 'Menga biriktirilgan buyurtmalar ro‘yxati',
    description:
      'Solishtirish uchun: sizga biriktirilgan yoki hozir qo‘lingizdagi buyurtmalar. ' +
      '`status` — vergul bilan bir nechta holat. `from`/`to` — BUYURTMA YARATILGAN kun ' +
      '(Toshkent vaqti).',
  })
  @ApiOkResponse({ type: CarrierOrderListResponseDto })
  @ApiBadRequestResponse({
    description: 'Noma’lum holat yoki sana formati xato',
    type: CarrierErrorResponseDto,
  })
  listOrders(
    @Query() query: CarrierOrderListQueryDto,
    @Req() req: CarrierRequest,
  ) {
    return this.carrierService.listOrders(req.carrier, query);
  }

  /**
   * Kuryer kassasi: balans va tarix — sotuvdan tushgan summa (kirim) va
   * BeePost'ga topshirilgan naqd (chiqim).
   */
  @Get('cashbox')
  @ApiOperation({
    summary: 'Kassa: balans va harakatlar tarixi',
    description:
      '`balance` — BeePost’ga topshirilishi kerak bo‘lgan summa (oynaga bog‘liq emas). Tarix — ' +
      '`from`..`to` (Toshkent kunlari, sukut: oxirgi 30 kun, eng ko‘pi 92 kun). Yo‘nalish ' +
      '`type` dan (income/expense), `amount` doim musbat. Xodim ma’lumotlari qaytmaydi.',
  })
  @ApiOkResponse({ type: CarrierCashboxResponseDto })
  @ApiBadRequestResponse({
    description: 'Sana formati xato, from > to yoki oraliq 92 kundan uzun',
    type: CarrierErrorResponseDto,
  })
  cashbox(@Query() query: CarrierCashboxQueryDto, @Req() req: CarrierRequest) {
    return this.carrierService.cashbox(req.carrier, query);
  }
}
