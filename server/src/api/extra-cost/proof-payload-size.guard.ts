import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PROOF_MAX_TOTAL_BYTES } from './proof-storage.const';

/**
 * ISBOT YUKLASH SO'ROVINING JAMI HAJMI — multerdan OLDINGI darvoza.
 *
 * ⚠️ NEGA GUARD, SERVIS EMAS. NestJS tartibi: middleware → GUARD →
 * interceptor → handler. Ya'ni bu guard `FilesInterceptor` ISHGA
 * TUSHMASDAN oldin bajariladi.
 *
 * Servisdagi tekshiruv (jami bayt) to'g'ri, lekin u KECH: multer o'sha
 * paytgacha barcha fayllarni DISKKA yozib bo'lgan bo'ladi. 5 ta 80 MB
 * video = 400 MB bekorga yozilgan disk, va buni takrorlab yuborish diskni
 * to'ldirish yo'li edi.
 *
 * (Avval multer XOTIRAGA o'qirdi va oqibat yanada og'irroq — OOM — edi;
 * shuning uchun saqlash `diskStorage` ga ko'chirilgan.)
 *
 * `Content-Length` ni klient soxtalashtira oladi (kamaytirib yuborsa),
 * lekin u holda multer o'zining `fileSize`/`files` chegaralariga uriladi va
 * servisdagi jami tekshiruv oxirgi devor bo'lib qoladi. Ya'ni bu guard
 * himoyani ALMASHTIRMAYDI, faqat eng arzon joyda birinchi zarbani to'sadi.
 */
@Injectable()
export class ProofPayloadSizeGuard implements CanActivate {
  /** Multipart chegaralari va sarlavhalari uchun zaxira. */
  private static readonly OVERHEAD_BYTES = 2 * 1024 * 1024;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers['content-length'];
    if (!raw) return true; // chunked — multer o'zi cheklaydi

    const length = Number(raw);
    if (!Number.isFinite(length)) return true;

    const max = PROOF_MAX_TOTAL_BYTES + ProofPayloadSizeGuard.OVERHEAD_BYTES;
    if (length > max) {
      const mb = (n: number) => (n / (1024 * 1024)).toFixed(0);
      throw new BadRequestException(
        `Fayllarning umumiy hajmi ${mb(PROOF_MAX_TOTAL_BYTES)} MB dan ` +
          `oshmasligi kerak (siz ~${mb(length)} MB yubordingiz). ` +
          `Videoni qisqaroq oling yoki fayl sonini kamaytiring.`,
      );
    }
    return true;
  }
}
