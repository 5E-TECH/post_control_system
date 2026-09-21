import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fsp from 'fs/promises';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import {
  FFMPEG_BIN,
  PROOF_TRANSCODE_TIMEOUT_MS,
  PROOF_VIDEO_AUDIO_KBPS,
  PROOF_VIDEO_BOX_PX,
  PROOF_VIDEO_CRF,
  isVideoMime,
  resolveProofPath,
} from './proof-storage.const';

/** Siqish holati — entity'dagi `transcode_status` qiymatlari. */
export const TRANSCODE = {
  PENDING: 'pending',
  /** DA'VO QILINGAN — ayni paytda ffmpeg ishlayapti. */
  WORKING: 'working',
  DONE: 'done',
  SKIPPED: 'skipped',
  FAILED: 'failed',
} as const;

/**
 * `working` holatida shuncha turib qolgan yozuv "tashlab ketilgan" deb
 * hisoblanadi (server siqish o'rtasida qayta ishga tushgan).
 */
export const TRANSCODE_STUCK_MS = 30 * 60 * 1000;

export type TranscodeResult = 'done' | 'skipped' | 'failed';

/**
 * VIDEO ISBOTNI SIQISH (ffmpeg).
 *
 * ⚠️ NEGA SERVERDA, KLIENTDA EMAS. Brauzerda videoni ishonchli siqishning
 * amaliy yo'li yo'q: `MediaRecorder` qayta kodlash uchun REAL VAQT talab
 * qiladi (30 soniyalik video = kamida 30 soniya kutish) va mobil Safari'da
 * sifat/kodek kafolati yo'q; `ffmpeg.wasm` esa ~25 MB kutubxona yuklab,
 * telefonda bir necha daqiqa ishlaydi. Kuryer mijoz oldida turganda
 * ikkalasi ham yaroqsiz.
 *
 * ⚠️ NEGA FONDA. Siqish 10-60 soniya davom etadi. Uni yuklash so'roviga
 * qo'shish kuryerni shuncha kuttirардi va HTTP timeout'ga urilardi. Shuning
 * uchun fayl AVVAL asl holida saqlanadi (isbot darhol mavjud va ko'rinadi),
 * siqish esa keyin fonda bo'ladi.
 *
 * ⚠️ NEGA BIR VAQTDA BITTA. ffmpeg protsessorni to'liq egallaydi. Bir necha
 * kuryer bir vaqtda video yuklasa, parallel siqish serverni (API, bot,
 * CRON — hammasi shu jarayonda) sekinlashtirib yuborardi.
 *
 * ⚠️ XATO HECH NARSANI BUZMAYDI. ffmpeg yo'q bo'lsa, yiqilsa yoki muddatdan
 * oshsa — ASL FAYL joyida qoladi va isbot ishlayveradi. Siqish
 * optimallashtirish, dalilning o'zi emas.
 */
@Injectable()
export class ProofTranscodeService implements OnModuleInit {
  private readonly logger = new Logger(ProofTranscodeService.name);

  /** `null` — hali tekshirilmagan. */
  private ffmpegReady: boolean | null = null;

  private readonly queue: string[] = [];
  private draining = false;

  constructor(
    @InjectRepository(ExtraCostProofEntity)
    private readonly proofRepo: Repository<ExtraCostProofEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.probeFfmpeg();
  }

  // ═══════════════════════ NAVBAT ═══════════════════════

  /**
   * Isbotni siqish navbatiga qo'yadi. `await` QILINMAYDI — chaqiruvchi
   * (yuklash endpointi) javobni darhol qaytarishi kerak.
   */
  enqueue(proofId: string): void {
    if (!proofId || this.queue.includes(proofId)) return;
    this.queue.push(proofId);
    void this.drain();
  }

  /** Navbatdagi ishlar soni — CRON va testlar uchun. */
  get pendingCount(): number {
    return this.queue.length;
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const id = this.queue.shift() as string;
        try {
          await this.transcodeOne(id);
        } catch (e) {
          // Bitta faylning xatosi butun navbatni to'xtatmasligi kerak.
          this.logger.error(
            `Siqish xatosi (${id}): ` +
              (e instanceof Error ? e.message : String(e)),
          );
        }
      }
    } finally {
      this.draining = false;
    }
  }

  // ═══════════════════════ SIQISH ═══════════════════════

  /**
   * Bitta isbotni siqadi.
   *
   * Tartib ATAYLAB shunday:
   *   1. ffmpeg vaqtinchalik YANGI faylga yozadi (asl fayl tegilmaydi)
   *   2. natija asl fayldan kichik ekani tekshiriladi
   *   3. DB YANGILANADI (yangi nom/hajm/mime)
   *   4. ENDI asl fayl o'chiriladi
   *
   * ⚠️ 3 va 4 ning tartibi muhim. Teskari bo'lsa va DB yangilanishi
   * yiqilsa, isbot BUTUNLAY yo'qolardi — DB eski faylga ishora qilib
   * turardi, fayl esa yo'q. Hozirgi tartibda eng yomon holat — diskda
   * ortiqcha fayl qolishi (zararsiz).
   */
  async transcodeOne(proofId: string): Promise<TranscodeResult> {
    const row = await this.proofRepo.findOne({ where: { id: proofId } });
    if (!row) return 'skipped';

    // Arzon erta chiqish (atomik da'vodan oldin) — keraksiz UPDATE qilmaslik.
    if (row.transcode_status !== TRANSCODE.PENDING) return 'skipped';
    if (!isVideoMime(row.mime)) {
      await this.mark(proofId, TRANSCODE.SKIPPED);
      return 'skipped';
    }

    /**
     * ⚠️ ATOMIK DA'VO — IKKI MARTA SIQISHNING YAGONA ISHONCHLI TO'SIG'I.
     *
     * Ikki manba bir xil faylni olishi mumkin: xotiradagi navbat va
     * CRON tergichi. Faqat "holatni o'qib, keyin tekshirish" yetmaydi —
     * ikkalasi ham `pending` ni O'QIB ULGURADI va ikkita ffmpeg bitta
     * faylga tushadi.
     *
     * Oqibati jiddiy: ikkita chiqish fayli yaratiladi, DB ulardan BITTASIGA
     * ishora qiladi, ikkinchisi esa diskda ABADIY qolib ketadi (orfan
     * tozalash faqat BOG'LANMAGAN isbotlarni oladi, bu esa bog'langan).
     *
     * Shart `UPDATE ... WHERE status='pending'` ICHIDA, ya'ni g'olibni
     * baza tanlaydi — bu loyihadagi tasdiqlash darvozasi bilan bir xil naqsh.
     *
     * Bu xato QO'LDA SINOVDA topilgan: uchdan-uchiga skript bitta videoni
     * ikki marta siqib, logda ikkita "siqildi" yozuvi chiqargan.
     */
    const claim = await this.proofRepo.update(
      { id: proofId, transcode_status: TRANSCODE.PENDING },
      { transcode_status: TRANSCODE.WORKING, updated_at: Date.now() },
    );
    if (!claim.affected) return 'skipped';

    if (!(await this.probeFfmpeg())) {
      this.logger.warn(
        `ffmpeg topilmadi (${FFMPEG_BIN}) — video asl holida qoladi (${proofId})`,
      );
      await this.mark(proofId, TRANSCODE.SKIPPED);
      return 'skipped';
    }

    const srcAbs = resolveProofPath(row.rel_path, row.stored_name);
    const outName = `${crypto.randomUUID()}.mp4`;
    const outAbs = resolveProofPath(row.rel_path, outName);

    const originalSize = row.size_bytes;

    try {
      await this.runFfmpeg(srcAbs, outAbs);

      const stat = await fsp.stat(outAbs);
      // ⚠️ Natija kattaroq bo'lsa ASL FAYL QOLADI. Allaqachon siqilgan
      // (masalan boshqa ilovadan kelgan) video qayta kodlanganda ko'pincha
      // KATTALASHADI — bunday "siqish" faqat sifatni yo'qotardi.
      if (stat.size >= originalSize) {
        await fsp.unlink(outAbs).catch(() => undefined);
        await this.mark(proofId, TRANSCODE.SKIPPED);
        this.logger.log(
          `Siqish foydasiz (${proofId}): ${mb(originalSize)} → ${mb(stat.size)} MB, asl fayl qoldirildi`,
        );
        return 'skipped';
      }

      await this.proofRepo.update(
        { id: proofId },
        {
          stored_name: outName,
          mime: 'video/mp4',
          size_bytes: stat.size,
          original_size_bytes: originalSize,
          transcode_status: TRANSCODE.DONE,
          updated_at: Date.now(),
        },
      );

      // ⚠️ DB YANGILANGANDAN KEYIN. Linux'da ochiq deskriptorli faylni
      // o'chirish uni o'qiyotgan oqimni buzmaydi, shuning uchun ayni
      // paytda isbotni ko'rayotgan market ham ta'sirlanmaydi.
      await fsp.unlink(srcAbs).catch((e) => {
        this.logger.warn(
          `Asl fayl o'chirilmadi (${srcAbs}): ${(e as Error).message}`,
        );
      });

      this.logger.log(
        `Video siqildi (${proofId}): ${mb(originalSize)} → ${mb(stat.size)} MB ` +
          `(${Math.round((1 - stat.size / originalSize) * 100)}% kamaydi)`,
      );
      return 'done';
    } catch (e) {
      await fsp.unlink(outAbs).catch(() => undefined);
      await this.mark(proofId, TRANSCODE.FAILED);
      this.logger.warn(
        `Video siqilmadi (${proofId}), asl fayl qoldirildi: ` +
          (e instanceof Error ? e.message : String(e)),
      );
      return 'failed';
    }
  }

  private async mark(proofId: string, status: string): Promise<void> {
    // ⚠️ `updated_at` QO'LDA qo'yiladi: `@BeforeUpdate` ilgagi faqat
    // `save()` da ishlaydi, `update()` da EMAS. Busiz "working holatida
    // qotib qolgan" yozuvni aniqlaydigan vaqt belgisi eskirib qolardi.
    await this.proofRepo
      .update(
        { id: proofId },
        { transcode_status: status, updated_at: Date.now() },
      )
      .catch(() => undefined);
  }

  // ═══════════════════════ FFMPEG ═══════════════════════

  /**
   * ffmpeg mavjudmi. Natija KESHLANADI — har video uchun qayta tekshirish
   * keraksiz jarayon ochardi.
   */
  async probeFfmpeg(): Promise<boolean> {
    if (this.ffmpegReady !== null) return this.ffmpegReady;
    this.ffmpegReady = await new Promise<boolean>((resolve) => {
      try {
        // ⚠️ `shell: false` (standart). Buyruq qatori HECH QACHON shell
        // orqali o'tmaydi — argumentlar massiv sifatida beriladi.
        const p = spawn(FFMPEG_BIN, ['-version'], { stdio: 'ignore' });
        p.on('error', () => resolve(false));
        p.on('close', (code) => resolve(code === 0));
      } catch {
        resolve(false);
      }
    });

    if (this.ffmpegReady) {
      this.logger.log(`ffmpeg topildi (${FFMPEG_BIN}) — video siqish YOQILDI`);
    } else {
      this.logger.warn(
        `ffmpeg topilmadi (${FFMPEG_BIN}) — videolar ASL hajmda saqlanadi. ` +
          `O'rnatish: sudo apt-get install -y ffmpeg`,
      );
    }
    return this.ffmpegReady;
  }

  /**
   * ffmpeg argumentlari.
   *
   * ⚠️ MASSIV, satr EMAS. Shell orqali o'tkazilsa fayl nomidagi maxsus
   * belgilar buyruq in'ektsiyasiga olib kelardi (nomlar `randomUUID` bo'lsa
   * ham, bu naqshni ochiq qoldirish kerak emas).
   */
  buildArgs(srcAbs: string, outAbs: string): string[] {
    const box = PROOF_VIDEO_BOX_PX;
    return [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      srcAbs,

      // ⚠️ `min(box, iw)` — KATTALASHTIRMASLIK uchun. `force_original_...
      // =decrease` o'zi kichik videoni ham qutiga "cho'zib" yuborardi.
      // Kvadrat quti ikkala yo'nalishni (yotiq va TIK telefon videosi)
      // bir xil to'g'ri ishlaydi: 1920x1080 → 1280x720, 1080x1920 → 720x1280.
      //
      // Ikkinchi `scale` — o'lchamlarni JUFT songa tekislaydi: H.264
      // (yuv420p) toq o'lchamni qabul qilmaydi va ffmpeg xato beradi.
      '-vf',
      `scale='min(${box},iw)':'min(${box},ih)':force_original_aspect_ratio=decrease,` +
        `scale=trunc(iw/2)*2:trunc(ih/2)*2`,

      // Faqat BIRINCHI video va (bo'lsa) birinchi audio oqimi. `?` —
      // ovozsiz video ham o'tadi (aks holda ffmpeg "stream not found"
      // bilan yiqilardi).
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',

      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      String(PROOF_VIDEO_CRF),
      '-pix_fmt',
      'yuv420p',
      // Brauzerda darhol o'ynashi uchun metadata fayl BOSHIGA ko'chiriladi.
      // Busiz `<video>` butun faylni yuklab bo'lgunча boshlamasdi.
      '-movflags',
      '+faststart',

      '-c:a',
      'aac',
      '-b:a',
      `${PROOF_VIDEO_AUDIO_KBPS}k`,
      '-ac',
      '1',

      // Telefon videolarida oqim vaqtlari sakrashi mumkin — standart navbat
      // to'lib, ffmpeg yiqilardi.
      '-max_muxing_queue_size',
      '1024',

      outAbs,
    ];
  }

  /**
   * ffmpeg'ni ishga tushiradi va tugashini kutadi.
   *
   * ⚠️ TIMEOUT SHART. Buzilgan yoki g'alati kodekli fayl ffmpeg'ni cheksiz
   * kuttirishi mumkin, jarayon esa protsessorni band qilib turardi.
   */
  private runFfmpeg(srcAbs: string, outAbs: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const args = this.buildArgs(srcAbs, outAbs);
      const proc = spawn(FFMPEG_BIN, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        // Xato matni ~4 KB bilan chegaralanadi: ffmpeg gapiruvchan bo'lishi
        // mumkin va butun chiqishni xotirada saqlash keraksiz.
        if (stderr.length < 4096) stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(
          new Error(
            `ffmpeg ${PROOF_TRANSCODE_TIMEOUT_MS / 1000}s ichida tugamadi`,
          ),
        );
      }, PROOF_TRANSCODE_TIMEOUT_MS);

      proc.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg kodi ${code}: ${stderr.trim()}`));
      });
    });
  }
}

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
