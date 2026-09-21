import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Telegraf } from 'telegraf';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { ExtraCostStatus, Roles } from 'src/common/enums';
import config from 'src/config';
import { isVideoMime, resolveProofPath } from './proof-storage.const';

/** Tugmalar uchun prefiks — `order:` va `order_ai:` bilan to'qnashmasin. */
export const EC_CALLBACK_PREFIX = 'ec:';

/**
 * RAD ETISH SABABLARI — TAYYOR RO'YXAT.
 *
 * ⚠️ NEGA ERKIN MATN EMAS. Rad etishda sabab MAJBURIY (kamida 3 belgi) —
 * kuryer nega rad etilganini bilmasa xuddi shu xatoni takrorlaydi. Telegramda
 * erkin matn olish uchun esa "javob kutish" holatini saqlash kerak bo'lardi:
 * market bir necha so'rovni ketma-ket ko'rib chiqsa, kiritilgan matn qaysi
 * so'rovga tegishli ekani chalkashib ketardi.
 *
 * Tayyor sabablar bu holatni butunlay yo'q qiladi: bosish = to'liq qaror.
 * Boshqacha sabab kerak bo'lsa — panelda erkin matn bor.
 */
export const EC_REJECT_REASONS: Record<string, string> = {
  '1': "Isbot ko'rinmayapti yoki tushunarsiz",
  '2': 'Bu xarajat asossiz',
  '3': 'Summa juda katta — kelishilmagan',
  '4': "Bu xarajat allaqachon to'langan",
};

/**
 * QO'SHIMCHA XARAJAT — TELEGRAM XABARI VA TUGMALARI.
 *
 * ⚠️ FAQAT YUBORISH. Qaror qabul qilish mantig'i bu yerda EMAS — u
 * `ExtraCostDecisionService` da, callback esa `OrderBotUpdate` da ulanadi.
 * Sabab: aks holda `Request → Telegram → Decision → Request` provayder sikli
 * hosil bo'lardi.
 *
 * ⚠️ ISBOT FAQAT MARKET EGASIGA (DM). GURUHGA EMAS.
 *
 * Isbot — mijozning eshigi, kvartira raqami, cheki bo'lishi mumkin. Guruhda
 * kuryerlar, operatorlar, ba'zan begonalar bo'ladi. Bundan tashqari guruh
 * callback'i faqat `chat_id` ni tekshiradi, TUGMANI BOSGAN ODAMNI emas —
 * ya'ni guruhdagi har kim (jumladan xarajatni yozgan kuryerning o'zi) pul
 * qarorini qabul qila olardi.
 *
 * ⚠️ TUGMALAR "ESKIRISHI" MUMKIN. Market qarorni PANELDAN qabul qilsa,
 * Telegramdagi tugmalar joyida qoladi. Bu xavfsiz: tasdiqlashning atomik
 * darvozasi (`UPDATE ... WHERE status='pending'`) ikkinchi qarorni o'tkazmaydi
 * va bosuvchi "allaqachon ko'rib chiqilgan" javobini oladi. Xabar id'larini
 * saqlab, keyin tahrirlash ham mumkin edi, lekin bu yangi ustun va yangi
 * nosozlik yuzasi demak — foydasi esa faqat kosmetik.
 */
@Injectable()
export class ExtraCostTelegramService {
  private readonly logger = new Logger(ExtraCostTelegramService.name);

  constructor(
    @InjectBot(config.ORDER_BOT_NAME) private readonly bot: Telegraf,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ExtraCostProofEntity)
    private readonly proofRepo: Repository<ExtraCostProofEntity>,
  ) {}

  // ═══════════════════════ YUBORISH ═══════════════════════

  /**
   * Marketga so'rovni yuboradi: isbot + matn + tugmalar.
   *
   * ⚠️ HECH QACHON XATO TASHLAMAYDI. Commit'dan keyin `await`siz chaqiriladi:
   * Telegram sekin javob bersa yoki bot bloklangan bo'lsa, sotuv oqimi bundan
   * ta'sirlanmasligi kerak.
   *
   * `true` — yuborildi; `false` — market botga ulanmagan yoki xato bo'ldi
   * (chaqiruvchi eski matnli xabarga qaytishi mumkin).
   */
  async sendRequest(request: ExtraCostRequestEntity): Promise<boolean> {
    try {
      // ⚠️ FAQAT `PENDING`. `AWAITING_PROOF` so'rov marketga HALI
      // YUBORILMAGAN — isboti yo'q va u panelda ham ko'rinmaydi.
      if (!request || request.status !== ExtraCostStatus.PENDING) return false;

      const owner = await this.userRepo.findOne({
        where: {
          id: request.market_id,
          role: Roles.MARKET,
          is_deleted: false,
        },
        select: ['id', 'telegram_id'],
      });
      if (!owner?.telegram_id) return false;

      const chatId = Number(owner.telegram_id);
      const caption = this.buildCaption(request);
      const keyboard = this.decisionKeyboard(request.id);

      const files = await this.loadProofFiles(request.proof_ids ?? []);

      // ── Isbot yo'q: oddiy matn + tugmalar ─────────────────────────────
      if (!files.length) {
        await this.bot.telegram.sendMessage(chatId, caption, {
          reply_markup: keyboard,
        });
        return true;
      }

      // ── Bitta fayl: rasm/video + IZOH + TUGMALAR bitta postda ─────────
      if (files.length === 1) {
        const f = files[0];
        const opts = { caption, reply_markup: keyboard } as const;
        if (f.isVideo) {
          await this.bot.telegram.sendVideo(chatId, { source: f.path }, opts);
        } else {
          await this.bot.telegram.sendPhoto(chatId, { source: f.path }, opts);
        }
        return true;
      }

      // ── Bir nechta fayl: albom + ALOHIDA tugma xabari ─────────────────
      //
      // ⚠️ Telegram media-guruhga inline tugma qo'yishga RUXSAT BERMAYDI.
      // Shuning uchun albom izoh bilan ketadi, tugmalar esa darhol keyingi
      // xabarda — foydalanuvchi uchun bu baribir bitta oqim bo'lib ko'rinadi.
      await this.bot.telegram.sendMediaGroup(
        chatId,
        files.slice(0, 10).map((f, i) => ({
          type: f.isVideo ? ('video' as const) : ('photo' as const),
          media: { source: f.path },
          // Izoh faqat BIRINCHISIDA — albomda u butun guruhga tegishli.
          ...(i === 0 ? { caption } : {}),
          // Telegraf `MediaGroup` turi rasm va videoni BIR MASSIVDA
          // aralashtirishga ruxsat bermaydi, Telegram API esa beradi
          // (albomda rasm ham, video ham bo'lishi mumkin).
        })) as any,
      );
      await this.bot.telegram.sendMessage(
        chatId,
        `⬆️ #${request.order_number} — qarorni tanlang:`,
        { reply_markup: keyboard },
      );
      return true;
    } catch (e) {
      this.logger.warn(
        `Telegramga yuborilmadi (${request?.id}): ` +
          (e instanceof Error ? e.message : String(e)),
      );
      return false;
    }
  }

  /** Qaror qabul qilinganidan keyin kuryerga xabar — u panelni kam ochadi. */
  async notifyCourier(
    request: ExtraCostRequestEntity,
    approved: boolean,
  ): Promise<void> {
    try {
      const courier = await this.userRepo.findOne({
        where: { id: request.courier_id, is_deleted: false },
        select: ['id', 'telegram_id'],
      });
      // ⚠️ Kuryerlarda `telegram_id` odatda YO'Q (u faqat market va operator
      // ro'yxatdan o'tishida to'ldiriladi). Shuning uchun bu — bonus kanal,
      // asosiysi emas: kuryer qarorni ilovadagi bannerdan ko'radi.
      if (!courier?.telegram_id) return;

      const sum = Number(request.amount).toLocaleString('uz-UZ');
      const text = approved
        ? `✅ #${request.order_number} — qo'shimcha xarajat tasdiqlandi.\n` +
          `Summa: ${sum} so'm hisobingizga o'tkazildi.`
        : `❌ #${request.order_number} — qo'shimcha xarajat rad etildi.\n` +
          `Summa: ${sum} so'm\n` +
          `Sabab: ${request.review_note ?? '—'}`;

      await this.bot.telegram.sendMessage(Number(courier.telegram_id), text);
    } catch {
      // Best-effort: xabar yetmagani pul oqimiga daxlsiz.
    }
  }

  // ═══════════════════════ TUGMALAR ═══════════════════════

  /** Asosiy qaror tugmalari. */
  decisionKeyboard(requestId: string) {
    return {
      inline_keyboard: [
        [
          { text: '✅ Tasdiqlash', callback_data: `ec:a:${requestId}` },
          { text: '❌ Rad etish', callback_data: `ec:r:${requestId}` },
        ],
      ],
    };
  }

  /**
   * Rad etish sababi tugmalari.
   *
   * Sabab MAJBURIY, shuning uchun "sababsiz rad etish" tugmasi ataylab YO'Q.
   */
  reasonKeyboard(requestId: string) {
    return {
      inline_keyboard: [
        ...Object.entries(EC_REJECT_REASONS).map(([code, text]) => [
          { text, callback_data: `ec:r:${requestId}:${code}` },
        ]),
        [{ text: '⬅️ Orqaga', callback_data: `ec:b:${requestId}` }],
      ],
    };
  }

  // ═══════════════════════ YORDAMCHILAR ═══════════════════════

  /**
   * Tugmani bosgan ODAMNI market egasi sifatida aniqlaydi.
   *
   * ⚠️ `chat_id` EMAS, `from.id`. Guruhda `chat_id` hamma uchun bir xil —
   * unga tayanish guruhdagi har kimga pul qarori huquqini berardi.
   *
   * Topilmasa `null`. So'rov egaligini bu yerda tekshirmaymiz: tasdiqlash
   * darvozasi `market_id = user.id` shartini SQL ichida qo'yadi, ya'ni
   * begona so'rov baribir o'tmaydi (ikki qatlamli himoya).
   */
  async resolveMarketOwner(fromId?: number): Promise<UserEntity | null> {
    if (!fromId) return null;
    return this.userRepo.findOne({
      where: { telegram_id: fromId, role: Roles.MARKET, is_deleted: false },
      select: ['id', 'name', 'telegram_id', 'role'],
    });
  }

  /**
   * Xabar matni.
   *
   * ⚠️ HAR BIR MAYDON QIRQILADI. Telegram izohi 1024 belgidan oshsa API 400
   * qaytaradi va xabar UMUMAN yetmaydi — ya'ni uzun market/mijoz nomi butun
   * tasdiqlash oqimini jimgina o'chirib qo'yardi. Qirqilgan nom — to'liq
   * yo'qolgan xabardan yaxshiroq (to'liq ma'lumot panelda bor).
   */
  private buildCaption(r: ExtraCostRequestEntity): string {
    const cut = (v: string | null | undefined, max = 60): string =>
      !v ? '' : v.length > max ? `${v.slice(0, max - 1)}…` : v;

    const sum = Number(r.amount).toLocaleString('uz-UZ');
    const limit = Number(r.limit_max || 0).toLocaleString('uz-UZ');
    const place = cut(
      [r.region_name, r.district_name].filter(Boolean).join(', '),
      80,
    );

    // ⚠️ `parse_mode` ATAYLAB YO'Q. Mijoz/market nomida `_` yoki `*` bo'lsa
    // Markdown butun xabarni buzadi (Telegram 400 qaytaradi va xabar
    // UMUMAN yetmaydi).
    return (
      `🧾 Qo'shimcha xarajat so'rovi\n\n` +
      `Buyurtma: #${r.order_number}\n` +
      `Summa: ${sum} so'm` +
      (Number(r.limit_max) > 0 ? ` (ruxsat: ${limit} so'm)` : '') +
      `\n` +
      (r.courier_name ? `Kuryer: ${cut(r.courier_name)}\n` : '') +
      (r.customer_name ? `Mijoz: ${cut(r.customer_name)}\n` : '') +
      (r.customer_phone ? `Tel: ${cut(r.customer_phone, 20)}\n` : '') +
      (place ? `Manzil: ${place}\n` : '') +
      (r.dup_proof_count > 1
        ? `\n⚠️ Bu isbot yana ${r.dup_proof_count - 1} ta so'rovda ishlatilgan!\n`
        : '') +
      `\n⚠️ Tasdiqlanmaguncha bu summa hisobingizdan yechilmaydi.`
    );
  }

  /** Isbot fayllarining DISKDAGI yo'lini yig'adi (tartib saqlanadi). */
  private async loadProofFiles(
    proofIds: string[],
  ): Promise<Array<{ path: string; isVideo: boolean }>> {
    if (!proofIds?.length) return [];
    try {
      const rows = await this.proofRepo.find({
        where: { id: In(proofIds) },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const out: Array<{ path: string; isVideo: boolean }> = [];
      for (const id of proofIds) {
        const row = byId.get(id);
        if (!row) continue;
        out.push({
          path: resolveProofPath(row.rel_path, row.stored_name),
          isVideo: isVideoMime(row.mime),
        });
      }
      return out;
    } catch (e) {
      // Fayl topilmasa ham xabar YUBORILADI — matni bilan.
      this.logger.warn(
        `Isbot fayllari o'qilmadi: ` +
          (e instanceof Error ? e.message : String(e)),
      );
      return [];
    }
  }
}
