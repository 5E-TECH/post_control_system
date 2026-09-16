import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { Roles } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import {
  PROOF_ALLOWED_MIME,
  PROOF_DIR,
  PROOF_MAX_FILES,
  PROOF_MAX_IMAGE_BYTES,
  PROOF_MAX_TOTAL_BYTES,
  PROOF_MAX_VIDEO_BYTES,
  PROOF_MIME_EXT,
  PROOF_ORPHAN_TTL_MS,
  PROOF_TMP_DIR,
  ensureProofSubdir,
  isVideoMime,
  proofStorageProblem,
  resolveProofPath,
} from './proof-storage.const';
import { ProofTranscodeService, TRANSCODE } from './proof-transcode.service';

/** Yuklangan fayl haqida klientga qaytariladigan MINIMAL ma'lumot. */
export interface ProofSummary {
  proof_id: string;
  size_bytes: number;
  /** Shu surat oxirgi sutkada yana nechta so'rovda ishlatilgan. */
  dup_count: number;
}

/**
 * FAYL TURINI MAZMUNI BO'YICHA ANIQLASH (magic byte).
 *
 * ⚠️ NEGA KLIENT MIME'GA ISHONMAYMIZ. `Content-Type` va fayl kengaytmasini
 * yuboruvchi to'liq boshqaradi. `.jpg` deb nomlangan HTML fayl bizning
 * domenimizdan berilsa — saqlangan XSS. Shuning uchun tur FAYLNING
 * BOSHIDAGI baytlardan aniqlanadi va faqat oq ro'yxatdagilar saqlanadi.
 *
 * Kutubxona ishlatilmadi: `file-type` ESM-only va loyihada yo'q; bizga
 * sanoqli format kerak.
 */
export function sniffMediaMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // ── RASMLAR ──────────────────────────────────────────────────────────
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // RIFF....WEBP
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  // ── VIDEO: EBML (WEBM / MKV) ─────────────────────────────────────────
  if (
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  ) {
    return 'video/webm';
  }

  // ── ISO-BMFF: ....ftyp<brand> ────────────────────────────────────────
  //
  // Bitta konteyner oilasi HAM rasm (HEIC), HAM video (MP4/MOV) bo'lishi
  // mumkin — farq faqat BRENDDA. Shuning uchun brend oq ro'yxati aniq.
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);

    // HEIC/HEIF — iPhone'ning standart RASM formati.
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) {
      return 'image/heic';
    }
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';

    // QuickTime (iPhone videosi) — `qt  ` (probel bilan to'ldirilgan).
    if (brand.startsWith('qt')) return 'video/quicktime';

    // 3GP — eski Android telefonlari.
    if (brand.startsWith('3g')) return 'video/3gpp';

    // MP4 oilasi.
    if (
      [
        'isom',
        'iso2',
        'iso4',
        'iso5',
        'iso6',
        'mp41',
        'mp42',
        'avc1',
        'dash',
        'M4V ',
        'M4VP',
        'mmp4',
      ].includes(brand)
    ) {
      return 'video/mp4';
    }

    // Noma'lum ISO-BMFF brendi — RAD ETAMIZ. "Ehtimol videodir" deb
    // o'tkazish oq ro'yxat tamoyilini buzardi.
    return null;
  }

  return null;
}

/** Baytni o'qiladigan MB ga aylantiradi (xato xabarlari uchun). */
function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * Faylning BOSHIDAGI baytlarni o'qiydi (tur aniqlash uchun).
 *
 * ⚠️ Butun fayl O'QILMAYDI. 80 MB lik videoni magic-byte tekshiruvi uchun
 * xotiraga olish — aynan diskka o'tishdan qochmoqchi bo'lgan narsamiz.
 */
async function readHead(abs: string, bytes: number): Promise<Buffer> {
  const fd = await fsp.open(abs, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fd.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fd.close();
  }
}

/**
 * Fayl sha256 ini OQIM bilan hisoblaydi.
 *
 * Dublikat isbotni aniqlash uchun butun fayl kerak, lekin uni bir vaqtda
 * xotirada ushlash shart emas — oqim 64 KB lik bo'laklar bilan ishlaydi.
 */
function hashFile(abs: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(abs);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

@Injectable()
export class ExtraCostProofService {
  constructor(
    @InjectRepository(ExtraCostProofEntity)
    private readonly proofRepo: Repository<ExtraCostProofEntity>,
    @InjectRepository(ExtraCostRequestEntity)
    private readonly requestRepo: Repository<ExtraCostRequestEntity>,
    private readonly transcode: ProofTranscodeService,
  ) {}

  /**
   * Kuryer yuklagan fayllarni saqlaydi.
   *
   * ⚠️ FAYLLAR DISKDAN KELADI, XOTIRADAN EMAS.
   *
   * Avval multer `memoryStorage()` ishlatardi va 25 MB chegarasida bu
   * maqbul edi. Video serverda siqila boshlagach chegara 80 MB ga (bitta
   * so'rov 120 MB gacha) ko'tarildi — bunday hajmni RAM'ga o'qish bir necha
   * kuryer bir vaqtda yuklaganda serverni OOM bilan o'ldirardi.
   *
   * Endi multer faylni `PROOF_TMP_DIR` ga yozadi, biz esa:
   *   - tur aniqlash uchun faqat BOSHIDAGI baytlarni o'qiymiz
   *   - sha256 ni OQIM bilan hisoblaymiz (butun faylni xotiraga olmasdan)
   *   - tekshiruvdan o'tgan faylni doimiy joyga `rename` qilamiz
   *
   * `rename` shuning uchun ishlaydi: `PROOF_TMP_DIR` ham, `PROOF_DIR` ham
   * `UPLOAD_ROOT` ichida, ya'ni BITTA fayl tizimida (boshqa diskka `rename`
   * EXDEV bilan yiqilardi).
   *
   * ⚠️ VAQTINCHALIK FAYL HAR QANDAY YO'LDA O'CHIRILADI — tekshiruv rad
   * etsa ham, DB yozuvi yiqilsa ham. Aks holda rad etilgan 80 MB lik
   * videolar diskda to'planib qolardi.
   */
  async saveUploaded(
    files: Array<{ path?: string; size: number; originalname?: string }>,
    courierId: string,
  ): Promise<ProofSummary[]> {
    const problem = proofStorageProblem();
    if (problem) throw new ServiceUnavailableException(problem);

    if (!files?.length) {
      throw new BadRequestException('Fayl yuborilmadi');
    }
    if (files.length > PROOF_MAX_FILES) {
      throw new BadRequestException(
        `Eng ko'pi ${PROOF_MAX_FILES} ta fayl yuborish mumkin`,
      );
    }

    // Multer `diskStorage` har doim `path` beradi; bermasa — sozlash xatosi.
    const tmpPaths = files.map((f) => f.path).filter((p): p is string => !!p);
    if (tmpPaths.length !== files.length) {
      await this.discardTmp(tmpPaths);
      throw new ServiceUnavailableException(
        'Fayl saqlanmadi — administratorga murojaat qiling',
      );
    }

    try {
      // ⚠️ UMUMIY BYUDJET — bu yerda, BITTA so'rov ichida tekshiriladi.
      //
      // Multer'ning `limits.fileSize` faqat BITTA faylga ishlaydi: 5 ta
      // 80 MB video undan bemalol o'tib, 400 MB bo'lardi. Klient ilgari har
      // faylni ALOHIDA so'rovda yuborardi va o'shanda jami chegarani
      // majburlashning printsipial iloji yo'q edi — endi hammasi bitta
      // so'rovda keladi.
      //
      // `ProofPayloadSizeGuard` bu tekshiruvni multerdan OLDIN ham qiladi
      // (Content-Length bo'yicha); bu yerdagisi — oxirgi devor.
      const totalBytes = files.reduce((acc, f) => acc + (f.size ?? 0), 0);
      if (totalBytes > PROOF_MAX_TOTAL_BYTES) {
        throw new BadRequestException(
          `Fayllarning umumiy hajmi ${mb(PROOF_MAX_TOTAL_BYTES)} MB dan ` +
            `oshmasligi kerak (siz ${mb(totalBytes)} MB yubordingiz). ` +
            `Videoni qisqaroq oling yoki fayl sonini kamaytiring.`,
        );
      }

      const now = new Date();
      const relDir = ensureProofSubdir(now);
      const moved: string[] = [];
      const out: ProofSummary[] = [];

      try {
        for (const file of files) {
          const tmpAbs = file.path as string;
          const size = file.size ?? 0;

          // ── Tur FAQAT MAZMUN bo'yicha ─────────────────────────────────
          const head = await readHead(tmpAbs, 4096);
          const mime = sniffMediaMime(head);
          if (
            !mime ||
            !(PROOF_ALLOWED_MIME as readonly string[]).includes(mime)
          ) {
            throw new BadRequestException(
              'Faqat rasm (JPG, PNG, WEBP, HEIC) yoki video ' +
                '(MP4, MOV, WEBM) yuborish mumkin.',
            );
          }

          // ── Turga xos hajm chegarasi ──────────────────────────────────
          // Video kattaroq bo'lishi tabiiy (serverda siqiladi), lekin
          // rasmga 80 MB berish klient siqishi ishlamaganini yashirardi.
          const perFileMax = isVideoMime(mime)
            ? PROOF_MAX_VIDEO_BYTES
            : PROOF_MAX_IMAGE_BYTES;
          if (size > perFileMax) {
            throw new BadRequestException(
              isVideoMime(mime)
                ? `Video ${mb(perFileMax)} MB dan katta bo'lmasligi kerak ` +
                  `(bu ${mb(size)} MB). Qisqaroq video oling.`
                : `Rasm ${mb(perFileMax)} MB dan katta bo'lmasligi kerak ` +
                  `(bu ${mb(size)} MB).`,
            );
          }

          const sha256 = await hashFile(tmpAbs);

          // Fayl nomi FOYDALANUVCHIDAN olinmaydi: `randomUUID` + serverda
          // aniqlangan MIME'dan kelib chiqqan kengaytma. Aks holda
          // `../../x.jpg` yoki `x.html` kabi nomlar diskka tushardi.
          const storedName = `${crypto.randomUUID()}${PROOF_MIME_EXT[mime]}`;
          const abs = resolveProofPath(relDir, storedName);

          await fsp.rename(tmpAbs, abs);
          moved.push(abs);

          const dupCount = await this.countRecentDuplicates(courierId, sha256);

          const row = this.proofRepo.create({
            courier_id: courierId,
            stored_name: storedName,
            rel_path: relDir,
            mime,
            size_bytes: size,
            sha256,
            request_id: null,
            bound_at: null,
            // Rasm siqilmaydi (klient allaqachon siqqan) — `null` = tegishli
            // emas. Video esa navbatga tushadi.
            transcode_status: isVideoMime(mime) ? TRANSCODE.PENDING : null,
            original_size_bytes: null,
          });
          await this.proofRepo.save(row);

          // ⚠️ `await` YO'Q — siqish 10-60 soniya davom etadi va kuryer uni
          // kutmasligi kerak. Isbot asl holida ALLAQACHON saqlangan.
          if (isVideoMime(mime)) this.transcode.enqueue(row.id);

          out.push({
            proof_id: row.id,
            size_bytes: row.size_bytes,
            dup_count: dupCount,
          });
        }
      } catch (e) {
        // Yarim yozilgan holat qolmasin: DB yozuvi muvaffaqiyatsiz bo'lsa ham
        // diskda yetim fayl turmasin. (Orfan CRON ham bor, lekin u 24 soatlik.)
        await Promise.all(
          moved.map((f) => fsp.unlink(f).catch(() => undefined)),
        );
        throw e;
      }

      return out;
    } finally {
      // Ko'chirilmagan (rad etilgan yoki xatoda qolgan) vaqtinchalik
      // fayllar HAR QANDAY yo'lda o'chiriladi.
      await this.discardTmp(tmpPaths);
    }
  }

  /** Vaqtinchalik fayllarni o'chiradi (allaqachon ko'chirilganiga tegmaydi). */
  private async discardTmp(paths: string[]): Promise<void> {
    await Promise.all(paths.map((p) => fsp.unlink(p).catch(() => undefined)));
  }

  /**
   * Shu kuryer oxirgi sutkada AYNI suratni yana nechta so'rovda ishlatgan.
   *
   * Qattiq TAQIQ yo'q — bitta reysdagi bitta taksi cheki bir nechta
   * buyurtmaga tegishli bo'lishi mumkin. Lekin market kartasida bu raqam
   * qizil signal sifatida KO'RINADI.
   */
  private async countRecentDuplicates(
    courierId: string,
    sha256: string,
  ): Promise<number> {
    const since = Date.now() - PROOF_ORPHAN_TTL_MS;
    // `created_at` — bigint (epoch ms), shuning uchun oddiy `>=` solishtiruvi.
    return this.proofRepo
      .createQueryBuilder('p')
      .where('p.courier_id = :cid', { cid: courierId })
      .andWhere('p.sha256 = :sha', { sha: sha256 })
      .andWhere('p.created_at >= :since', { since })
      .getCount();
  }

  /**
   * `proof_ids` ni so'rovga bog'lash uchun TEKSHIRADI.
   *
   * Uch shart: fayl shu kuryerniki, hali bog'lanmagan, va diskda MAVJUD.
   * Oxirgisi muhim — DB yozuvi bor-u fayl yo'q bo'lsa, market kartasida
   * buzilgan rasm chiqadi va nizoda dalil bo'lmaydi.
   *
   * Yozuvlarni QAYTARADI (bog'lash so'rov yaratilgan tranzaksiyada bo'ladi).
   */
  async validateOwnedUnbound(
    proofIds: string[],
    courierId: string,
  ): Promise<ExtraCostProofEntity[]> {
    if (!proofIds?.length) return [];

    const unique = [...new Set(proofIds)];
    if (unique.length > PROOF_MAX_FILES) {
      throw new BadRequestException(
        `Eng ko'pi ${PROOF_MAX_FILES} ta isbot biriktirish mumkin`,
      );
    }

    const rows = await this.proofRepo.find({
      where: { id: In(unique), courier_id: courierId, request_id: IsNull() },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException(
        "Isbot topilmadi yoki allaqachon boshqa so'rovga biriktirilgan — " +
          'rasmni qayta yuklang',
      );
    }

    for (const row of rows) {
      const abs = resolveProofPath(row.rel_path, row.stored_name);
      if (!fs.existsSync(abs)) {
        throw new BadRequestException(
          'Isbot fayli serverda topilmadi — rasmni qayta yuklang',
        );
      }
    }
    return rows;
  }

  /**
   * Himoyalangan o'qish: fayl faqat so'rov EGALARIGA beriladi.
   *
   * ⚠️ `/uploads` static papkasidan ATAYLAB foydalanilmaydi — u
   * autentifikatsiyasiz va helmet'dan OLDIN ro'yxatdan o'tgan (`nosniff`
   * qo'llanmaydi). Isbot esa pul nizosi hujjati.
   */
  async openForViewer(
    requestId: string,
    proofId: string,
    user: JwtPayload,
  ): Promise<{ absPath: string; mime: string; size: number }> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException("So'rov topilmadi");

    // `JwtPayload.role` — `string` (tokendan keladi), `Roles` esa enum.
    // Niyatni aniq bildirib solishtiramiz: token roli har doim `Roles`
    // qiymatlaridan biri bo'ladi (`RolesGuard` buni allaqachon kafolatlagan).
    const role = user.role as Roles;
    const isAdmin = role === Roles.ADMIN || role === Roles.SUPERADMIN;
    const isOwnerCourier = request.courier_id === user.id;
    const isOwnerMarket = request.market_id === user.id;
    if (!isAdmin && !isOwnerCourier && !isOwnerMarket) {
      throw new ForbiddenException("Bu isbotni ko'rish huquqingiz yo'q");
    }

    // Isbot AYNAN shu so'rovga tegishli bo'lishi shart — aks holda market
    // o'z so'rovining id'si bilan BOSHQA marketning isbotini o'qib olardi.
    const belongs = (request.proof_ids ?? []).includes(proofId);
    if (!belongs) throw new NotFoundException('Isbot topilmadi');

    const proof = await this.proofRepo.findOne({ where: { id: proofId } });
    if (!proof) throw new NotFoundException('Isbot topilmadi');

    const absPath = resolveProofPath(proof.rel_path, proof.stored_name);
    if (!fs.existsSync(absPath)) {
      throw new NotFoundException('Isbot fayli serverda topilmadi');
    }
    return { absPath, mime: proof.mime, size: proof.size_bytes };
  }

  /**
   * Bog'lanmagan (orfan) fayllarni tozalaydi.
   *
   * Kuryer rasm yukladi-yu sotuvni yakunlamadi (ilovani yopdi, tarmoq uzildi)
   * — fayl diskda qolaveradi. TTL o'tgach u ham diskdan, ham DB'dan o'chadi.
   *
   * Nechta o'chirilganini qaytaradi.
   */
  async cleanupOrphans(now = Date.now()): Promise<number> {
    const cutoff = now - PROOF_ORPHAN_TTL_MS;
    const orphans = await this.proofRepo
      .createQueryBuilder('p')
      .where('p.request_id IS NULL')
      .andWhere('p.created_at < :cutoff', { cutoff })
      .limit(500)
      .getMany();

    let removed = 0;
    for (const row of orphans) {
      try {
        const abs = resolveProofPath(row.rel_path, row.stored_name);
        await fsp.unlink(abs).catch(() => undefined);
        await this.proofRepo.delete({ id: row.id });
        removed++;
      } catch {
        // Bitta fayl o'chmasa qolganlari to'xtamasin.
      }
    }
    return removed;
  }

  /**
   * YARIM QOLGAN YUKLASH FAYLLARI (`.part`).
   *
   * ⚠️ NEGA KERAK. Odatda `saveUploaded` vaqtinchalik faylni o'zi
   * o'chiradi (`finally` blokida). Lekin yuklash O'RTASIDA uzilsa
   * (kuryerning interneti uzildi, server qayta ishga tushdi), multer
   * yozib ulgurgan bo'lak diskda qolib ketadi va uni hech kim
   * o'chirmaydi. Bitta bo'lak 80 MB gacha bo'lishi mumkin.
   *
   * 2 soatdan eski fayllar olinadi — ayni paytda ketayotgan yuklashga
   * tegib ketmaslik uchun (sekin mobil internetda 120 MB uzoq ketadi).
   */
  async cleanupStaleTmp(now = Date.now()): Promise<number> {
    const cutoff = now - 2 * 60 * 60 * 1000;
    let entries: string[];
    try {
      entries = await fsp.readdir(PROOF_TMP_DIR);
    } catch {
      return 0;
    }

    let removed = 0;
    for (const name of entries) {
      const abs = path.join(PROOF_TMP_DIR, name);
      try {
        const st = await fsp.stat(abs);
        if (!st.isFile() || st.mtimeMs >= cutoff) continue;
        await fsp.unlink(abs);
        removed++;
      } catch {
        // Bitta fayl o'chmasa qolganlari to'xtamasin.
      }
    }
    return removed;
  }

  /** Bo'sh qolgan `YYYY/MM` papkalarini olib tashlaydi (kosmetik). */
  async pruneEmptyDirs(): Promise<void> {
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 2) return;
      let entries: fs.Dirent[];
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.isDirectory()) await walk(path.join(dir, e.name), depth + 1);
      }
      if (dir !== PROOF_DIR) {
        const left = await fsp.readdir(dir).catch(() => ['x']);
        if (left.length === 0) await fsp.rmdir(dir).catch(() => undefined);
      }
    };
    await walk(PROOF_DIR, 0);
  }
}
