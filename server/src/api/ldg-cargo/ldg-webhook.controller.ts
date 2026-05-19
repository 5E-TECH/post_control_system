import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { LdgWebhookService } from './ldg-webhook.service';
import { LDG_HEADERS } from './dto/ldg-webhook.dto';

/**
 * LDG dan kelgan webhook'larni qabul qiluvchi endpoint.
 *
 * MUHIM:
 *   - Bu endpoint **hech qanday auth guard ostida bo'lmaydi** (LDG dan keladi,
 *     bizning JWT yo'q). Auth o'rniga HMAC-SHA256 signature ishlaydi.
 *   - Body **raw** (Buffer) sifatida olinadi — chunki signature verify uchun
 *     parsing oldidan stringni ko'rishimiz kerak. main.ts da
 *     `app.use('/api/ldg/webhook', express.raw({ type: 'application/json' }))`
 *     deb sozlanadi.
 */
@Controller('ldg/webhook')
export class LdgWebhookController {
  private readonly logger = new Logger(LdgWebhookController.name);

  constructor(private readonly webhookService: LdgWebhookService) {}

  @ApiExcludeEndpoint()
  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: Request,
    @Res() res: Response,
    @Headers(LDG_HEADERS.SIGNATURE) signature: string,
    @Headers(LDG_HEADERS.DELIVERY_ID) deliveryId: string,
    @Headers(LDG_HEADERS.EVENT) eventType: string,
  ): Promise<void> {
    // Raw body Buffer (Express raw middleware orqali)
    const rawBody = this.extractRawBody(req);

    const result = await this.webhookService.process({
      rawBody,
      signatureHeader: signature ?? '',
      deliveryIdHeader: deliveryId ?? '',
      eventTypeHeader: eventType ?? '',
    });

    res.status(result.http_status).json({
      received: result.http_status === 200,
      message: result.message,
    });
  }

  private extractRawBody(req: Request): string {
    const body = req.body;
    if (Buffer.isBuffer(body)) return body.toString('utf8');
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object') {
      // Fallback: agar raw middleware ishlamasa, JSON.stringify qilamiz
      // (signature verify ishonchsiz bo'ladi — chunki LDG yuborgan aniq stringni
      // qayta tiklash mumkin emas)
      this.logger.warn(
        'LDG webhook: raw body topilmadi, JSON.stringify ishlatilmoqda — signature verify zaif',
      );
      return JSON.stringify(body);
    }
    return '';
  }
}
