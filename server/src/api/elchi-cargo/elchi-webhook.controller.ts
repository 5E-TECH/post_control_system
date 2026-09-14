import { Controller, Headers, HttpCode, Logger, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ElchiWebhookService } from './elchi-webhook.service';
import { ELCHI_SIGNATURE_HEADER } from './dto/elchi-webhook.dto';

/**
 * Elchi'dan kelgan webhooklarni qabul qiluvchi endpoint.
 *
 * MUHIM:
 *   - Bu endpoint **hech qanday auth guard ostida BO'LMAYDI** — so'rov Elchi'dan
 *     keladi, bizning JWT'imiz yo'q. Auth o'rniga HMAC-SHA256 imzo ishlaydi.
 *   - Tana **XOM** (Buffer) sifatida olinadi: imzo aynan Elchi yuborgan baytlar
 *     ustidan hisoblanadi. `JSON.parse` → `JSON.stringify` aylanishi kalit
 *     tartibini/bo'shliqni o'zgartirib hashni buzadi. Shu bois
 *     `app.service.ts`da bu yo'l uchun `express.raw()` sozlanadi va u
 *     `express.json()`dan OLDIN turishi shart.
 */
@Controller('elchi/webhook')
export class ElchiWebhookController {
  private readonly logger = new Logger(ElchiWebhookController.name);

  constructor(private readonly webhookService: ElchiWebhookService) {}

  @ApiExcludeEndpoint()
  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: Request,
    @Res() res: Response,
    @Headers(ELCHI_SIGNATURE_HEADER) signature: string,
  ): Promise<void> {
    const rawBody = this.extractRawBody(req);

    const result = await this.webhookService.process({
      rawBody,
      signatureHeader: signature ?? '',
    });

    res.status(result.http_status).json({
      received: result.http_status === 200,
      message: result.message,
    });
  }

  /**
   * Xom tanani oladi.
   *
   * Agar `express.raw()` sozlanmagan bo'lsa (deploy xatosi), body allaqachon
   * parse qilingan obyekt bo'ladi. Bunday holatda `JSON.stringify` bilan
   * qaytarish imzoni BUZADI — shuning uchun ochiq ogohlantirish yozamiz.
   * Imzo mos kelmasa xizmat 401 qaytaradi, ya'ni xato jimgina o'tmaydi.
   */
  private extractRawBody(req: Request): string {
    const body = req.body;
    if (Buffer.isBuffer(body)) return body.toString('utf8');
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object') {
      this.logger.error(
        "Elchi webhook: XOM tana topilmadi — express.raw() sozlanmaganga " +
          "o'xshaydi. Imzo tekshiruvi ISHLAMAYDI (401 qaytadi).",
      );
      return JSON.stringify(body);
    }
    return '';
  }
}
