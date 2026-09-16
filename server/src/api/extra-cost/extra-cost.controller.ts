import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { createReadStream, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { AcceptRoles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from 'src/common/decorator/user.decorator';
import { JwtGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { successRes } from 'src/infrastructure/lib/response';
import { ExtraCostProofService } from './extra-cost-proof.service';
import { ExtraCostDecisionService } from './extra-cost-decision.service';
import {
  AttachProofDto,
  BulkApproveDto,
  ListExtraCostDto,
  RejectExtraCostDto,
} from './dto/extra-cost-decision.dto';
import {
  PROOF_MAX_FILES,
  PROOF_MAX_VIDEO_BYTES,
  PROOF_TMP_DIR,
} from './proof-storage.const';
import { ProofPayloadSizeGuard } from './proof-payload-size.guard';

@ApiTags('Extra cost')
@ApiBearerAuth()
@Controller('extra-cost')
export class ExtraCostController {
  constructor(
    private readonly proofService: ExtraCostProofService,
    private readonly decisions: ExtraCostDecisionService,
  ) {}

  /**
   * ISBOT YUKLASH — sotuvdan ALOHIDA qadam.
   *
   * ⚠️ NEGA SOTUV ENDPOINTI MULTIPART QILINMADI. Kuryer modalda rasm tanlaydi
   * → fayl DARHOL shu yerga ketadi → qaytgan `proof_id` sotuv so'roviga oddiy
   * JSON maydon sifatida qo'shiladi. Natijada jonli pul yo'li (`sellOrder`,
   * `cancelOrder`, `partlySold`) umuman o'zgarmaydi — portlash radiusi nol.
   *
   * Yonaki foyda: fayl yuklanmay qolsa sotuv YIQILMAYDI. Kuryer "isbotsiz
   * davom etish" bilan sotuvni yopadi, so'rov esa isbot kutish holatida
   * qoladi.
   */
  @ApiOperation({ summary: "Qo'shimcha xarajat uchun foto isbot yuklash" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'proof_id ro‘yxati' })
  // ⚠️ `ProofPayloadSizeGuard` INTERSEPTORDAN OLDIN ishlaydi (NestJS tartibi:
  // guard -> interceptor). U `Content-Length` ni o'qib, byudjetdan katta
  // so'rovni multer BOSHLANMASDAN OLDIN rad etadi — aks holda 125 MB video
  // avval xotiraga o'qilib, keyin rad etilardi (DoS yo'li).
  @UseGuards(JwtGuard, RolesGuard, ThrottlerGuard, ProofPayloadSizeGuard)
  @AcceptRoles(Roles.COURIER)
  // Endi HAMMA fayl BITTA so'rovda keladi, shuning uchun daqiqasiga 6 ta
  // yuklash real ishlatish uchun yetarli (avval har fayl alohida so'rov edi
  // va 5 rasmli ikkinchi buyurtmayoq 429 olardi).
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('files', PROOF_MAX_FILES, {
      // ⚠️ XOTIRAGA emas, VAQTINCHALIK DISKKA.
      //
      // Avval `memoryStorage()` edi va 25 MB chegarasida bu maqbul bo'lgan.
      // Video serverda siqila boshlagach bitta fayl 80 MB, bitta so'rov esa
      // 120 MB gacha bo'ladi — buni RAM'ga o'qish bir necha kuryer bir
      // vaqtda yuklaganda serverni OOM bilan o'ldirardi.
      //
      // Rad etilgan fayl diskda qolib ketmaydi: `saveUploaded` HAR QANDAY
      // yo'lda (xato ham, muvaffaqiyat ham) vaqtinchalik fayllarni
      // o'chiradi, orfan CRON'i esa ikkinchi devor.
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          try {
            // Boot'da yaratiladi, lekin papka qo'lda o'chirilgan bo'lishi
            // mumkin — multer ishlamay qolmasin.
            mkdirSync(PROOF_TMP_DIR, { recursive: true });
            cb(null, PROOF_TMP_DIR);
          } catch (e) {
            cb(e as Error, PROOF_TMP_DIR);
          }
        },
        // Nom FOYDALANUVCHIDAN olinmaydi. `.part` — bu hali tekshirilmagan
        // fayl; doimiy nom va kengaytma `saveUploaded` da, aniqlangan
        // MIME asosida beriladi.
        filename: (_req, _file, cb) => cb(null, `${randomUUID()}.part`),
      }),
      limits: {
        // Eng katta RUXSAT ETILGAN bitta fayl — turga qarab aniq chegara
        // servisda qo'llanadi (video 80 MB, rasm 8 MB).
        fileSize: PROOF_MAX_VIDEO_BYTES,
        files: PROOF_MAX_FILES,
        fieldSize: 1024,
      },
    }),
  )
  @Post('proof')
  async uploadProof(
    @UploadedFiles()
    files: Array<{ path?: string; size: number; originalname?: string }>,
    @CurrentUser() user: JwtPayload,
  ) {
    const saved = await this.proofService.saveUploaded(files, user.id);
    // ⚠️ Javobda FAYL NOMI ham, URL ham YO'Q — faqat `proof_id`. Fayl nomi
    // chiqsa, uni taxmin qilib boshqa kuryerning isbotini so'rash mumkin
    // bo'lardi (nom `randomUUID` bo'lsa ham, oshkor qilishning hojati yo'q).
    return successRes(saved, 201, 'Isbot yuklandi');
  }

  /**
   * ISBOTNI KO'RISH — egalik tekshiruvi bilan.
   *
   * ⚠️ `/uploads` static papkasidan ATAYLAB foydalanilmaydi: u
   * autentifikatsiyasiz va `helmet` dan OLDIN ro'yxatdan o'tgan, ya'ni
   * `X-Content-Type-Options: nosniff` unga qo'llanmaydi. Isbot esa pul
   * nizosining hujjati — uni faqat taraflar ko'rishi kerak.
   */
  @ApiOperation({ summary: "Isbot rasmini ko'rish (egalik tekshiriladi)" })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER, Roles.MARKET, Roles.ADMIN, Roles.SUPERADMIN)
  @Get(':id/proof/:proofId')
  async viewProof(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proofId', ParseUUIDPipe) proofId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { absPath, mime, size } = await this.proofService.openForViewer(
      id,
      proofId,
      user,
    );

    // Brauzer turni O'ZI taxmin qilmasin — biz aniqlagan MIME yagona haqiqat.
    // Bu sarlavha qo'lda qo'yiladi, chunki fayl helmet zanjiridan o'tmaydi.
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="isbot-${proofId}"`);
    // Isbot — maxfiy hujjat. Oraliq keshlar (CDN/proksi) uni saqlab qolmasin.
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Accept-Ranges', 'bytes');

    /**
     * ⚠️ RANGE SO'ROVLARI HAQIQATAN ISHLANADI.
     *
     * Avval `Accept-Ranges: bytes` e'lon qilinib, `Range` sarlavhasi
     * E'TIBORSIZ qoldirilardi — ya'ni yolg'on va'da. Rasm uchun bu sezilmasdi,
     * lekin VIDEO uchun oqibati og'ir: brauzer `<video>` elementida oldinga
     * o'tishni (seek) Range orqali qiladi va server har safar butun faylni
     * boshidan yuborsa, video "qotib" qoladi yoki umuman ochilmaydi.
     */
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (match) {
        const startRaw = match[1];
        const endRaw = match[2];
        let start = startRaw ? Number(startRaw) : 0;
        let end = endRaw ? Number(endRaw) : size - 1;

        // Oxiridan so'rash: `bytes=-500` (oxirgi 500 bayt).
        if (!startRaw && endRaw) {
          start = Math.max(0, size - Number(endRaw));
          end = size - 1;
        }

        if (start >= size || start > end) {
          res.status(416);
          res.setHeader('Content-Range', `bytes */${size}`);
          res.end();
          return;
        }
        end = Math.min(end, size - 1);

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        res.setHeader('Content-Length', String(end - start + 1));
        createReadStream(absPath, { start, end }).pipe(res);
        return;
      }
    }

    res.setHeader('Content-Length', String(size));
    createReadStream(absPath).pipe(res);
  }

  // ═════════════════════════ MARKET ═════════════════════════

  /**
   * ⚠️ `market_id` TOKENDAN olinadi, URL parametridan EMAS.
   *
   * `GET order/market/:id` da mavjud IDOR bor — u market egaligini
   * tekshirmaydi. O'sha naqshni yangi sahifaga ko'chirmaslik uchun bu yerda
   * marketni tanlash imkoniyati UMUMAN yo'q.
   */
  @ApiOperation({ summary: "Market: qo'shimcha xarajat so'rovlari" })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('market/me')
  async listForMarket(
    @Query() query: ListExtraCostDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.decisions.listForMarket(user, {
      ...query,
      escalated: query.escalated === 'true',
    });
    return successRes(data, 200, "So'rovlar");
  }

  @ApiOperation({ summary: "Market: ko'rib chiqilmagan so'rovlar soni" })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Get('market/me/counts')
  async countForMarket(@CurrentUser() user: JwtPayload) {
    const counts = await this.decisions.countOpenForMarket(user);
    return successRes(counts, 200, 'Soni');
  }

  @ApiOperation({ summary: 'Market: xarajatni tasdiqlash (PUL YOZILADI)' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Post(':id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const req = await this.decisions.approve(id, user);
    return successRes(req, 200, 'Tasdiqlandi');
  }

  @ApiOperation({ summary: 'Market: xarajatni rad etish (sabab majburiy)' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Post(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExtraCostDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const req = await this.decisions.reject(id, user, dto.review_note);
    return successRes(req, 200, 'Rad etildi');
  }

  @ApiOperation({ summary: 'Market: belgilanganlarni tasdiqlash' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.MARKET)
  @Post('bulk-approve')
  async bulkApprove(
    @Body() dto: BulkApproveDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.decisions.bulkApprove(dto.ids, user);
    return successRes(result, 200, 'Bajarildi');
  }

  // ═════════════════════════ KURYER ═════════════════════════

  @ApiOperation({ summary: "Kuryer: o'z so'rovlari va holatlari" })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Get('courier/me')
  async listForCourier(
    @Query() query: ListExtraCostDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.decisions.listForCourier(user, query);
    return successRes(data, 200, "So'rovlar");
  }

  @ApiOperation({ summary: "Kuryer: ko'rilmagan qarorlar soni (banner)" })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Get('courier/me/counts')
  async countForCourier(@CurrentUser() user: JwtPayload) {
    const counts = await this.decisions.countUnseenForCourier(user);
    return successRes(counts, 200, 'Soni');
  }

  /**
   * ISBOTNI KEYINCHALIK BIRIKTIRISH.
   *
   * ⚠️ BUSIZ "isbotsiz davom etish" TUZOQ edi: so'rov `awaiting_proof` da
   * qolib, 24 soatdan keyin bekor bo'lardi va kuryer pulini yo'qotardi —
   * tasdiqlash darvozasi faqat `pending` ni qabul qiladi.
   */
  @ApiOperation({
    summary: "Kuryer: awaiting_proof so'roviga isbot biriktirish",
  })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Post(':id/attach-proof')
  async attachProof(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachProofDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const req = await this.decisions.attachProof(id, user, dto.proof_ids);
    return successRes(req, 200, 'Isbot biriktirildi');
  }

  @ApiOperation({ summary: "Kuryer: qarorlarni ko'rdim (banner yopiladi)" })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.COURIER)
  @Post('courier/me/seen')
  async markSeen(@CurrentUser() user: JwtPayload) {
    const marked = await this.decisions.markSeenByCourier(user);
    return successRes({ marked }, 200, "Ko'rildi");
  }

  // ═════════════════════════ ADMIN ARBITRAJI ═════════════════════════

  @ApiOperation({ summary: "Admin: arbitraj navbati (muddati o'tganlar)" })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Get('admin')
  async listForAdmin(
    @Query() query: ListExtraCostDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.decisions.listForAdmin(user, {
      ...query,
      escalated: query.escalated === 'true',
    });
    return successRes(data, 200, "So'rovlar");
  }

  /**
   * Admin arbitraji — market rad etgan, lekin kuryerda haqiqiy chek bor
   * holati uchun. Har bir qaror alohida `admin_override` bilan loglanadi.
   */
  @ApiOperation({ summary: 'Admin: majburan tasdiqlash yoki rad etish' })
  @UseGuards(JwtGuard, RolesGuard)
  @AcceptRoles(Roles.ADMIN, Roles.SUPERADMIN)
  @Post(':id/admin-resolve')
  async adminResolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExtraCostDto & { decision?: 'approve' | 'reject' },
    @CurrentUser() user: JwtPayload,
  ) {
    if (dto.decision === 'reject') {
      const req = await this.decisions.reject(id, user, dto.review_note, {
        adminOverride: true,
      });
      return successRes(req, 200, 'Rad etildi (admin)');
    }
    const req = await this.decisions.approve(id, user, { adminOverride: true });
    return successRes(req, 200, 'Tasdiqlandi (admin)');
  }
}
