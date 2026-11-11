import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import { ExtraCostStatus } from 'src/common/enums';
import { ExtraCostProofService } from './extra-cost-proof.service';
import { ExtraCostDecisionService } from './extra-cost-decision.service';
import { ExtraCostTelegramService } from './extra-cost-telegram.service';
import {
  ProofTranscodeService,
  TRANSCODE,
  TRANSCODE_STUCK_MS,
} from './proof-transcode.service';
import { JwtPayload } from 'src/common/utils/types/user.type';

/**
 * Market javob bermasa — «muddati o'tgan» belgisi qo'yiladi VA oxirgi
 * eslatma yuboriladi (pul HARAKAT QILMAYDI).
 *
 * ⚠️ AVVAL 7 KUN EDI va asoslanishi shunday yozilgan edi: «oraliqda
 * ODAM (admin) qaror qilishi uchun vaqt beriladi». Tekshirilganda
 * ma'lum bo'ldiki, bunday ADMIN EKRANI UMUMAN YO'Q — qo'shimcha
 * xarajat sahifalari faqat `market` va `courier` rollariga ochiq,
 * `escalated_at` esa faqat MARKETNING o'z «muddati o'tgan» tabida
 * ko'rinadi. Ya'ni o'rtadagi hafta hech kim qaramaydigan bo'sh vaqt
 * edi va kuryer shuncha kutardi.
 */
const ESCALATE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Eslatmadan keyin ham javob bo'lmasa — avtomatik tasdiq (jami 3 kun).
 *
 * ⚠️ NEGA 3-KUNNING O'ZIDA EMAS. Market so'rov yaratilganda BITTA
 * Telegram xabari oladi va boshqa hech narsa kelmaydi. Muddat qisqargach
 * o'tkazib yuborilgan bitta xabar = pul jimgina o'tib ketishi bo'lardi.
 * Shuning uchun 2-kuni ESLATMA yuboriladi (tugmalari bilan) va faqat
 * undan keyin avtomatik tasdiq. Shunda market 3 kun va IKKI xabar
 * oladi — e'tibor bermasa bu haqiqatan uning aybi.
 */
const BACKSTOP_AFTER_ESCALATION_MS = 1 * 24 * 60 * 60 * 1000;

/**
 * QO'SHIMCHA XARAJAT — rejali ishlar.
 *
 * To'rt vazifa:
 *
 *   ORFAN ISBOT     — kuryer rasm yukladi-yu sotuvni yakunlamadi. Fayl
 *                     diskda, DB'da `request_id IS NULL` bo'lib qolaveradi.
 *   ISBOT MUDDATI   — 24 soatda biriktirilmagan so'rov bekor bo'ladi
 *                     (SOTUVGA tegmaydi).
 *   ESLATMA         — market 2 kun javob bermadi → oxirgi Telegram
 *                     eslatmasi + «muddati o'tgan» belgisi
 *                     (pul HARAKAT QILMAYDI).
 *   ZAXIRA TASDIQ   — jami 3 kun javobsiz → avtomatik tasdiq
 *                     (BU YERDA PUL HARAKAT QILADI, har biri ovozli
 *                     loglanadi).
 */
@Injectable()
export class ExtraCostCron {
  private readonly logger = new Logger(ExtraCostCron.name);

  /**
   * ⚠️ Bir vaqtda faqat bitta ishlash. `@Cron` oldingi ishni kutmaydi —
   * tozalash sekin ketsa (ko'p fayl, sekin disk), ikkinchi tik boshlanib
   * ayni fayllarni o'chirishga urinardi.
   */
  private running = false;

  private escalating = false;
  private backstopping = false;
  private sweepingTranscode = false;

  constructor(
    private readonly proofService: ExtraCostProofService,
    private readonly decisions: ExtraCostDecisionService,
    private readonly telegram: ExtraCostTelegramService,
    private readonly transcode: ProofTranscodeService,
    @InjectRepository(ExtraCostRequestEntity)
    private readonly requestRepo: Repository<ExtraCostRequestEntity>,
    @InjectRepository(ExtraCostProofEntity)
    private readonly proofRepo: Repository<ExtraCostProofEntity>,
  ) {}

  /**
   * SIQILMAY QOLGAN VIDEOLARNI TERIB OLADI — har 10 daqiqada.
   *
   * ⚠️ NEGA KERAK. Siqish navbati XOTIRADA turadi: video yuklangach
   * `enqueue` chaqiriladi va fon jarayoni uni oladi. Lekin server aynan
   * shu orada qayta ishga tushsa (deploy, pm2 restart, crash), navbat
   * yo'qoladi va video ASL (katta) holida diskda qolib ketardi —
   * hech kim buni sezmasdi.
   *
   * Shuning uchun holat DB'da (`transcode_status`) saqlanadi va bu ish
   * "pending" bo'lib qolganlarni qaytadan navbatga qo'yadi.
   *
   * 2 daqiqalik "yosh" sharti — hozir ishlanayotgan faylni qayta olib,
   * ikkita ffmpeg'ni bitta faylga tushirmaslik uchun.
   */
  @Cron('0 */10 * * * *', { timeZone: 'Asia/Tashkent' })
  async sweepPendingTranscodes(): Promise<void> {
    if (this.sweepingTranscode) return;
    this.sweepingTranscode = true;
    try {
      const now = Date.now();

      // ── 1. "working" holatida QOTIB QOLGANLARNI tiklash ───────────────
      //
      // ⚠️ Siqish boshlangач yozuv `working` ga o'tadi (ikki marta
      // siqilmasligi uchun atomik da'vo). Server AYNAN shu paytda qayta
      // ishga tushsa, hech kim uni `working` dan chiqarmaydi va video
      // ABADIY siqilmay qolardi.
      const revived = await this.proofRepo
        .createQueryBuilder()
        .update(ExtraCostProofEntity)
        .set({ transcode_status: TRANSCODE.PENDING, updated_at: now })
        .where('transcode_status = :w', { w: TRANSCODE.WORKING })
        .andWhere('updated_at < :stuck', { stuck: now - TRANSCODE_STUCK_MS })
        .execute();
      if (revived.affected) {
        this.logger.warn(
          `Yarim qolgan siqish tiklandi: ${revived.affected} ta video`,
        );
      }

      // ── 2. Navbatga tushmay qolganlarni terish ────────────────────────
      //
      // 2 daqiqalik "yosh" sharti — hozir yuklanayotgan faylni erta olib,
      // xotiradagi navbat bilan bekorga poyga qilmaslik uchun.
      const cutoff = now - 2 * 60 * 1000;
      const stale = await this.proofRepo
        .createQueryBuilder('p')
        .select(['p.id'])
        .where('p.transcode_status = :s', { s: TRANSCODE.PENDING })
        .andWhere('p.created_at < :cutoff', { cutoff })
        .orderBy('p.created_at', 'ASC')
        .limit(50)
        .getMany();

      if (!stale.length) return;
      this.logger.log(`Siqilmagan video topildi: ${stale.length} ta`);
      for (const row of stale) this.transcode.enqueue(row.id);
    } catch (e) {
      this.logger.error(
        `Siqish navbatini terishda xato: ` +
          (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      this.sweepingTranscode = false;
    }
  }

  /**
   * Har soatda, 17-daqiqada.
   *
   * Nega "yaxlit" soat emas: loyihada boshqa CRON'lar ham bor va hammasi
   * 0-daqiqada turtib ketsa, bazaga bir vaqtda yuk tushadi.
   */
  @Cron('0 17 * * * *', { timeZone: 'Asia/Tashkent' })
  async cleanupOrphanProofs(): Promise<void> {
    if (this.running) {
      this.logger.warn("Orfan isbot tozalash hali ishlayapti — tik o'tkazildi");
      return;
    }
    this.running = true;
    try {
      const removed = await this.proofService.cleanupOrphans();
      if (removed > 0) {
        this.logger.log(`Orfan isbotlar tozalandi: ${removed} ta fayl`);
        await this.proofService.pruneEmptyDirs();
      }
      // Uzilib qolgan yuklashdan qolgan `.part` fayllari. Ular 80 MB
      // gacha bo'lishi mumkin, ya'ni bir necha uzilish diskni tez to'ldiradi.
      const tmp = await this.proofService.cleanupStaleTmp();
      if (tmp > 0) {
        this.logger.log(`Yarim qolgan yuklash fayllari tozalandi: ${tmp} ta`);
      }
    } catch (e) {
      // ⚠️ CRON xatosi butun ilovani yiqitmasligi kerak. Tozalash
      // ishlamasa eng yomon oqibat — disk sekinroq to'ladi, ya'ni bu
      // ogohlantirish darajasidagi hodisa.
      this.logger.error(
        `Orfan isbot tozalashda xato: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * ISBOT MUDDATI — 24 soatda biriktirilmagan so'rov bekor bo'ladi.
   *
   * ⚠️ SOTUVGA TEGMAYDI. Faqat xarajat so'rovi bekor bo'ladi: buyurtma
   * sotilgan holida qolaveradi, kassa ham tegilmaydi (pul hech qachon
   * yozilmagan edi).
   */
  @Cron('0 23 * * * *', { timeZone: 'Asia/Tashkent' })
  async voidStaleAwaitingProof(): Promise<void> {
    try {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const res = await this.requestRepo
        .createQueryBuilder()
        .update(ExtraCostRequestEntity)
        .set({
          status: ExtraCostStatus.VOID,
          // `review_note` — kuryer ko'radigan maydon. `awaiting_proof`
          // holatida u odatda bo'sh, shuning uchun bu yerda yozish xavfsiz
          // va kuryerga NEGA bekor bo'lganini tushuntiradi.
          review_note: 'Isbot 24 soat ichida biriktirilmadi',
          voided_at: Date.now(),
          updated_at: Date.now(),
        })
        .where('status = :s', { s: ExtraCostStatus.AWAITING_PROOF })
        .andWhere('created_at < :cutoff', { cutoff })
        .execute();
      if (res.affected) {
        this.logger.log(
          `Isbot kutilmagan so'rovlar bekor qilindi: ${res.affected} ta`,
        );
      }
    } catch (e) {
      this.logger.error(
        `Isbot muddati CRON xatosi: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * ESLATMA — market 2 kun javob bermadi.
   *
   * ⚠️ STATUS O'ZGARMAYDI va PUL HARAKAT QILMAYDI. Ikki ish bajariladi:
   * marketga OXIRGI ESLATMA yuboriladi (tugmalari bilan) va «muddati
   * o'tgan» belgisi qo'yiladi. Ertaga javob bo'lmasa — avtomatik tasdiq.
   */
  @Cron('0 0 3 * * *', { timeZone: 'Asia/Tashkent' })
  async escalateStale(): Promise<void> {
    if (this.escalating) return;
    this.escalating = true;
    try {
      const cutoff = Date.now() - ESCALATE_AFTER_MS;

      /**
       * ⚠️ AVVAL OLAMIZ, KEYIN BELGILAYMIZ.
       *
       * Oldin bu bitta ommaviy `UPDATE` edi — qaysi so'rovlar
       * belgilangani noma'lum qolardi. Endi eslatma yuborish kerak,
       * ya'ni qatorlarning O'ZI kerak.
       */
      const stale = await this.requestRepo
        .createQueryBuilder('r')
        .where('r.status = :s', { s: ExtraCostStatus.PENDING })
        .andWhere('r.escalated_at IS NULL')
        .andWhere('r.created_at < :cutoff', { cutoff })
        .limit(200)
        .getMany();

      if (!stale.length) return;

      const now = Date.now();
      await this.requestRepo
        .createQueryBuilder()
        .update(ExtraCostRequestEntity)
        .set({ escalated_at: now, updated_at: now })
        .whereInIds(stale.map((r) => r.id))
        .execute();

      this.logger.warn(
        `Market 2 kun javob bermadi — oxirgi eslatma yuborilmoqda: ${stale.length} ta so'rov`,
      );

      /**
       * ⚠️ ESLATMA — bu bosqichning ASOSIY ishi, belgi emas.
       *
       * Market so'rov yaratilganda bitta xabar oladi, boshqa hech narsa
       * kelmaydi. Muddat 3 kun bo'lgach, bitta o'tkazib yuborilgan
       * xabar pulning jimgina o'tishiga olib kelardi.
       *
       * Ketma-ket yuboriladi: Telegram tezlik chegarasi bor va bitta
       * marketning bloklagani qolganlarini to'xtatmasligi kerak
       * (`sendReminder` xato tashlamaydi).
       */
      let sent = 0;
      for (const req of stale) {
        if (await this.telegram.sendReminder(req)) sent += 1;
      }
      this.logger.log(`Eslatma yuborildi: ${sent}/${stale.length}`);
    } catch (e) {
      this.logger.error(
        `Eskalatsiya CRON xatosi: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.escalating = false;
    }
  }

  /**
   * ZAXIRA TASDIQ — eslatmadan keyin ham 1 kun javob bo'lmadi (jami 3 kun).
   *
   * ⚠️ BU YERDA PUL HARAKAT QILADI. Shuning uchun:
   *   - har bir so'rov `decisions.approve()` orqali o'tadi, ya'ni AYNI
   *     tekshiruvlar (buyurtma holati, chegara, kuryer faolligi, kassa)
   *     qo'llanadi;
   *   - har biri OVOZLI loglanadi (`warn`), jimgina o'tib ketmasin.
   *
   * ⚠️ `decision_mode` AUDITDA `auto_backstop` bo'ladi, `market` EMAS.
   * Aks holda nizoda "market tasdiqlagan" deb ko'rsatilardi, holbuki market
   * umuman javob bermagan.
   */
  @Cron('0 10 3 * * *', { timeZone: 'Asia/Tashkent' })
  async backstopApprove(): Promise<void> {
    if (this.backstopping) return;
    this.backstopping = true;
    try {
      const cutoff = Date.now() - BACKSTOP_AFTER_ESCALATION_MS;
      const stale = await this.requestRepo
        .createQueryBuilder('r')
        .where('r.status = :s', { s: ExtraCostStatus.PENDING })
        .andWhere('r.escalated_at IS NOT NULL')
        .andWhere('r.escalated_at < :cutoff', { cutoff })
        .limit(100)
        .getMany();

      if (!stale.length) return;

      this.logger.warn(
        `ZAXIRA TASDIQ: ${stale.length} ta so'rov 3 kundan beri javobsiz — avtomatik tasdiqlanmoqda`,
      );

      for (const req of stale) {
        // Aktor — so'rovning o'z marketi (atomik darvoza `market_id` ni
        // tekshiradi). Rol `market` sifatida beriladi.
        const actor = { id: req.market_id, role: 'market' } as JwtPayload;
        try {
          await this.decisions.approve(req.id, actor, { autoBackstop: true });
          this.logger.warn(
            `Zaxira tasdiq: #${req.order_number} — ${req.amount} so'm ` +
              `(market ${req.market_id} 3 kun javob bermadi)`,
          );
        } catch (e) {
          // Bitta so'rov o'tmasa qolganlari to'xtamasin (kuryer o'chirilgan,
          // buyurtma rollback qilingan va h.k.).
          this.logger.error(
            `Zaxira tasdiq o'tmadi (${req.id}): ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    } catch (e) {
      this.logger.error(
        `Zaxira tasdiq CRON xatosi: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.backstopping = false;
    }
  }
}
