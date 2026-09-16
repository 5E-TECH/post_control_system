import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { In, QueryRunner } from 'typeorm';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import {
  ExtraCostAction,
  ExtraCostCategory,
  ExtraCostDecisionMode,
  ExtraCostStatus,
} from 'src/common/enums';
import { ExtraCostPolicy } from 'src/api/order/utils/extra-cost-policy.util';
import { ExtraCostProofService } from './extra-cost-proof.service';
import { ExtraCostTelegramService } from './extra-cost-telegram.service';
import { PROOF_ORPHAN_TTL_MS } from './proof-storage.const';
import { BotNotifyService } from '../bots/order_create-bot/bot-notify.service';

/** Sotuv/bekor/qisman sotuv oqimidan keladigan isbot maydonlari. */
export interface ExtraCostProofInput {
  extra_cost_proof_ids?: string[];
  extra_cost_category?: ExtraCostCategory;
  extra_cost_proof_deferred?: boolean;
}

/**
 * QO'SHIMCHA XARAJAT SO'ROVI — yozuvni yaratuvchi va holatini boshqaruvchi joy.
 *
 * ⚠️ ENG MUHIM QOIDA. `PENDING` va `AWAITING_PROOF` holatidagi so'rov
 * `cashbox_history` ga BIR QATOR HAM yozmaydi. `reverseExtraCostForCashbox`
 * idempotentlikni `SUM(EXTRA_COST chiqim) − SUM(CORRECTION kirim)` net-hisobi
 * bilan quradi — tasdiqlanmagan xarajat u yerga tushsa, keyingi rollback
 * YO'QDAN PUL YARATADI.
 *
 * ⚠️ BARCHA METODLAR CHAQIRUVCHINING TRANZAKSIYASIDA ishlaydi (`QueryRunner`
 * parametr sifatida keladi). Servis o'z tranzaksiyasini OCHMAYDI: sotuv
 * rollback bo'lsa so'rov ham yo'qolishi kerak, aks holda "pul yozilmagan,
 * lekin majburiyat bor" holati qoladi.
 */
@Injectable()
export class ExtraCostRequestService {
  private readonly logger = new Logger(ExtraCostRequestService.name);

  constructor(
    private readonly proofService: ExtraCostProofService,
    private readonly botNotify: BotNotifyService,
    private readonly telegram: ExtraCostTelegramService,
  ) {}

  /**
   * MARKETGA XABAR — yangi so'rov tasdiq kutmoqda.
   *
   * ⚠️ COMMIT'DAN KEYIN, `await`SIZ chaqiriladi. Telegram sekin javob berishi
   * yoki umuman ishlamasligi mumkin (bot bloklangan, tarmoq) — bu HECH QACHON
   * sotuvni ushlab turmasligi yoki yiqitmasligi kerak.
   *
   * ⚠️ IKKI KANAL, ANIQ TARTIB BILAN:
   *
   *   1. MARKET EGASIGA DM — isbot (rasm/video) + matn + ✅/❌ TUGMALARI.
   *      Tugma bosgan ODAM tekshiriladi (`from.id`), ya'ni qarorni faqat
   *      egasi qabul qila oladi.
   *
   *   2. Ega botga ulanmagan bo'lsa — eski MATNLI xabar (egasi +
   *      operatorlar), panelga yo'naltirish bilan.
   *
   * ⚠️ ISBOT GURUHGA YUBORILMAYDI. U mijozning eshigi/cheki bo'lishi mumkin,
   * guruhda esa kuryerlar va begonalar bor. Guruh callback'i faqat `chat_id`
   * ni tekshiradi — ya'ni guruhdagi har kim (jumladan xarajatni yozgan
   * kuryerning o'zi) pul qarorini qabul qila olardi.
   */
  notifyMarketAboutRequest(
    request: ExtraCostRequestEntity | null,
    courierName?: string | null,
  ): void {
    if (!request) return;
    // ⚠️ FAQAT `PENDING`. `AWAITING_PROOF` so'rov marketga HALI YUBORILMAGAN —
    // isboti yo'q, market uni panelda ham ko'rmaydi. Unga "panelga kiring,
    // tasdiqlang" deb xabar yuborish marketni bo'sh sahifaga olib borardi
    // (foydalanuvchi sinovda aynan shuni ko'rgan).
    if (request.status !== ExtraCostStatus.PENDING) return;

    const text =
      `🧾 Yangi qo'shimcha xarajat so'rovi\n\n` +
      `Buyurtma: #${request.order_number}\n` +
      `Summa: ${Number(request.amount).toLocaleString('uz-UZ')} so'm\n` +
      (courierName ? `Kuryer: ${courierName}\n` : '') +
      `\nTasdiqlash yoki rad etish uchun panelga kiring: ` +
      `Qo'shimcha xarajat bo'limi.\n` +
      `⚠️ Tasdiqlanmaguncha bu summa hisobingizdan yechilmaydi.`;

    void this.telegram
      .sendRequest(request)
      .then((sent) => {
        // Tugmali xabar yetgan bo'lsa, ikkinchi (matnli) xabar shunchaki
        // takror bo'lardi.
        if (sent) return undefined;
        return this.botNotify.notifyMarketUsers(request.market_id, text);
      })
      .catch(() => undefined);
  }

  /**
   * ISBOT TALABINI TEKSHIRADI — pul harakat qilishidan OLDIN.
   *
   * Bu yerda xato tashlansa, tranzaksiya hali hech narsa yozmagan bo'ladi.
   * Tekshiruvni keyinroqqa qoldirish "yarim bajarilgan sotuv" xavfini
   * tug'dirardi.
   *
   * Tekshirilgan isbot yozuvlarini qaytaradi (keyin bog'lash uchun).
   */
  async assertProofRequirement(
    policy: ExtraCostPolicy,
    input: ExtraCostProofInput,
    courierId: string,
  ): Promise<ExtraCostProofEntity[]> {
    const ids = input.extra_cost_proof_ids ?? [];

    if (!policy.requireProof) {
      // Isbot talab qilinmasa ham, yuborilgan bo'lsa TEKSHIRAMIZ — begona
      // faylni o'zlashtirib olishga urinish shu yerda to'siladi.
      return ids.length
        ? this.proofService.validateOwnedUnbound(ids, courierId)
        : [];
    }

    if (!ids.length) {
      // "Isbotsiz davom etish" — SOTUV YIQILMAYDI. Bu ataylab: kuryer mijoz
      // oldida turibdi, tarmoq esa uzilgan bo'lishi mumkin.
      //
      // ⚠️ LEKIN FAQAT `deferred` REJIMIDA. `immediate` rejimda pul DARHOL
      // yoziladi va so'rov `APPROVED` bo'lib YOPILADI — ya'ni "keyin
      // biriktiraman" degan va'da bajarilmaydi va isbot talabi butunlay
      // chetlab o'tiladi. Bu yo'l `auto_approve_under` chegarasi ostidagi
      // summalarda va narx pasaytirishda ochiq edi.
      if (input.extra_cost_proof_deferred && policy.mode === 'deferred') {
        return [];
      }
      if (input.extra_cost_proof_deferred) {
        throw new BadRequestException(
          'Bu xarajat darhol hisobga olinadi, shuning uchun isbot SHART — ' +
            '«isbotsiz davom etish» bu holatda ishlamaydi. Rasm yoki video yuklang.',
        );
      }
      throw new BadRequestException(
        "Bu market uchun qo'shimcha xarajatga foto isbot biriktirish shart. " +
          'Rasm yuklang yoki «isbotsiz davom etish»ni tanlang (24 soat muhlat).',
      );
    }

    // ⚠️ SABAB (kategoriya) MAJBURIY EMAS.
    //
    // Avval u majburiy edi va kuryer mijoz oldida turib ro'yxatdan birini
    // tanlashga majbur bo'lardi. Amalda hamma "Boshqa"ni bosardi — ya'ni
    // maydon hech qanday ma'lumot bermay, faqat sotuvni sekinlashtirardi.
    // Isbot (rasm/video) allaqachon sababni ko'rsatadi.
    //
    // Maydonning O'ZI saqlanib qoldi (DTO + ustun): keyin kerak bo'lsa
    // faqat UI qaytariladi, migratsiya kerak emas.
    return this.proofService.validateOwnedUnbound(ids, courierId);
  }

  /**
   * SO'ROV YOZUVINI YARATADI.
   *
   * ⚠️ FAQAT bayroq YOQILGAN marketlar uchun. Bayroq o'chiq bo'lsa `null`
   * qaytadi va hech narsa yozilmaydi — ya'ni bugungi 100% marketda hot-path
   * umuman tegilmaydi (qo'shimcha INSERT ham yo'q).
   *
   * `historyIds` — pul ALLAQACHON yozilgan bo'lsa (immediate yo'l) kassa
   * yozuvlarining id'lari. Ular idempotentlik langari sifatida saqlanadi.
   */
  async record(
    queryRunner: QueryRunner,
    params: {
      order: OrderEntity;
      market: UserEntity | null;
      courier: UserEntity;
      policy: ExtraCostPolicy;
      amount: number;
      actionType: ExtraCostAction;
      limitMax: number;
      courierTariff: number;
      input: ExtraCostProofInput;
      proofs: ExtraCostProofEntity[];
      historyIds?: { marketHistoryId: string; courierHistoryId: string } | null;
    },
  ): Promise<ExtraCostRequestEntity | null> {
    if (params.market?.extra_cost_proof_required !== true) return null;

    const amount = Math.trunc(Number(params.amount) || 0);
    if (amount <= 0) return null;

    const now = Date.now();
    const deferred = params.policy.mode === 'deferred';
    const awaitingProof = deferred && params.proofs.length === 0;

    // ⚠️ KONTEKST SHU YERDA YUKLANADI, chaqiruvchidan OLINMAYDI.
    //
    // Sotuv oqimida buyurtma `pessimistic_write` lock bilan RELATIONSIZ
    // yuklanadi (PG `FOR UPDATE` outer join'ni rad etadi), shuning uchun
    // `order.district` u yerda har doim `undefined` — natijada
    // `district_name` doim `null` bo'lib qolardi.
    //
    // Bu ikki so'rov FAQAT bayroq yoqilgan marketda bajariladi (yuqoridagi
    // erta `return null` dan keyin), ya'ni bugungi 100% marketda hot-path
    // umuman tegilmaydi.
    const ctx = await this.loadContext(queryRunner, params.order);

    const row = queryRunner.manager.create(ExtraCostRequestEntity, {
      order_id: params.order.id,
      post_id: params.order.post_id ?? null,
      courier_id: params.courier.id,
      // SNAPSHOT: buyurtma keyin boshqa marketga o'tkazilsa ham qarorni
      // asl market beradi.
      market_id: params.market.id,

      action_type: params.actionType,
      amount,
      limit_max: Math.max(0, Math.trunc(params.limitMax || 0)),
      courier_tariff_snapshot: Math.max(
        0,
        Math.trunc(params.courierTariff || 0),
      ),

      // DENORMALIZATSIYA — market sahifasi buyurtma endpointiga tegmasin
      // (u market egaligini tekshirmaydi = mavjud IDOR).
      order_number: Number(params.order.order_number) || 0,
      order_total_price: Math.trunc(Number(params.order.total_price) || 0),
      where_deliver: params.order.where_deliver ?? null,
      district_name: ctx.districtName,
      region_name: ctx.regionName,
      customer_name: ctx.customerName,
      customer_phone: ctx.customerPhone,
      // Parol hashini tortmaslik uchun nomlar SNAPSHOT qilinadi.
      market_name: params.market.name ?? null,
      courier_name: params.courier.name ?? null,
      order_action_at: now,

      category: params.input.extra_cost_category ?? ExtraCostCategory.OTHER,
      reason: null,
      proof_ids: params.proofs.map((p) => p.id),
      dup_proof_count: 0,

      status: deferred
        ? awaitingProof
          ? ExtraCostStatus.AWAITING_PROOF
          : ExtraCostStatus.PENDING
        : ExtraCostStatus.APPROVED,

      decision_mode: deferred
        ? null
        : (params.policy.decisionMode ?? ExtraCostDecisionMode.AUTO_RULE),

      // Pul allaqachon yozilgan bo'lsa — langarlarni saqlaymiz.
      settled_at: deferred ? null : now,
      market_history_id: params.historyIds?.marketHistoryId ?? null,
      courier_history_id: params.historyIds?.courierHistoryId ?? null,
      reviewed_at: null,
      reviewed_by: null,
    });

    await queryRunner.manager.save(ExtraCostRequestEntity, row);

    // Isbotlarni AYNI tranzaksiyada bog'laymiz — sotuv rollback bo'lsa
    // fayllar ham "bog'lanmagan" holatiga qaytadi va orfan CRON ularni oladi.
    if (params.proofs.length) {
      await queryRunner.manager.update(
        ExtraCostProofEntity,
        { id: In(params.proofs.map((p) => p.id)) },
        { request_id: row.id, bound_at: now },
      );
      await this.refreshDupCount(queryRunner, row, params.proofs);
    }

    return row;
  }

  /**
   * DUBLIKAT SANOG'INI YOZADI — market kartasidagi qizil signal.
   *
   * ⚠️ Avval bu ustun DOIM 0 edi: dublikat soni faqat YUKLASH javobida
   * qaytarilardi (kuryerga ko'rsatish uchun) va hech qayerda saqlanmasdi.
   * Ya'ni market "bu chek yana 3 ta so'rovda ishlatilgan" ogohlantirishini
   * HECH QACHON ko'rmasdi — bir taksi chekini 5 buyurtmaga yozish esa aynan
   * shu tizim to'sishi kerak bo'lgan xulq.
   *
   * Sanoq BOG'LANGANDAN KEYIN hisoblanadi, shuning uchun joriy so'rov ham
   * kiradi: 1 = normal, 2+ = takroriy ishlatilgan.
   */
  private async refreshDupCount(
    queryRunner: QueryRunner,
    row: ExtraCostRequestEntity,
    proofs: ExtraCostProofEntity[],
  ): Promise<void> {
    const hashes = [...new Set(proofs.map((p) => p.sha256).filter(Boolean))];
    if (!hashes.length) return;

    try {
      // Dublikat oynasi = orfan oynasi (24 soat). Ikkisi bir xil bo'lishi
      // shart emas, lekin ikkinchi sozlama qo'shish faqat chalkashtirardi.
      const since = Date.now() - PROOF_ORPHAN_TTL_MS;
      // Bitta fayl bir nechta so'rovga biriktirilgan bo'lsa, ENG YOMON
      // ko'rsatkich olinadi (max) — market e'tiborini shunga qaratamiz.
      const res: Array<{ dup: string }> = await queryRunner.manager.query(
        `SELECT COALESCE(MAX(c), 0)::int AS dup
           FROM (
             SELECT COUNT(DISTINCT p."request_id") AS c
               FROM "extra_cost_proof" p
              WHERE p."courier_id" = $1
                AND p."sha256" = ANY($2::text[])
                AND p."request_id" IS NOT NULL
                AND p."created_at" >= $3
              GROUP BY p."sha256"
           ) t`,
        [row.courier_id, hashes, since],
      );

      const dup = Number(res?.[0]?.dup ?? 0);
      if (dup > 1) {
        row.dup_proof_count = dup;
        await queryRunner.manager.update(
          ExtraCostRequestEntity,
          { id: row.id },
          { dup_proof_count: dup },
        );
      }
    } catch (e) {
      // ⚠️ Bu FAQAT ko'rsatkich. Sanash yiqilsa ham sotuv yiqilmasligi kerak.
      this.logger.warn(
        `Dublikat sanog'i hisoblanmadi (${row.id}): ` +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  }

  /**
   * Qaror uchun kerakli kontekstni yuklaydi (mijoz, manzil).
   *
   * ⚠️ `select` QAT'IY. `users` jadvalidan butun qatorni olish `password`
   * hashini xotiraga (va keyin API javobiga) olib kelardi.
   */
  private async loadContext(
    queryRunner: QueryRunner,
    order: OrderEntity,
  ): Promise<{
    districtName: string | null;
    regionName: string | null;
    customerName: string | null;
    customerPhone: string | null;
  }> {
    const out = {
      districtName: null as string | null,
      regionName: null as string | null,
      customerName: null as string | null,
      customerPhone: null as string | null,
    };

    try {
      if (order.district_id) {
        const rows: Array<{ district_name: string; region_name: string }> =
          await queryRunner.manager.query(
            `SELECT d."name" AS district_name, r."name" AS region_name
               FROM "district" d
               LEFT JOIN "region" r ON r."id" = d."region_id"
              WHERE d."id" = $1
              LIMIT 1`,
            [order.district_id],
          );
        if (rows?.length) {
          out.districtName = rows[0].district_name ?? null;
          out.regionName = rows[0].region_name ?? null;
        }
      }

      if (order.customer_id) {
        const customer = await queryRunner.manager.findOne(UserEntity, {
          where: { id: order.customer_id },
          select: ['id', 'name', 'phone_number'],
        });
        out.customerName = customer?.name ?? null;
        out.customerPhone = customer?.phone_number ?? null;
      }
    } catch {
      // ⚠️ KONTEKST YO'QLIGI SOTUVNI YIQITMASLIGI KERAK. Bu maydonlar
      // qulaylik uchun; ularsiz ham so'rov to'liq ishlaydi.
    }

    return out;
  }

  /**
   * KEYINCHALIK ISBOT BIRIKTIRISH — `AWAITING_PROOF` dan chiqish yo'li.
   *
   * ⚠️ BUSIZ `AWAITING_PROOF` TUGAB QOLGAN HOLAT EDI. Tasdiqlash darvozasi
   * faqat `PENDING` ni qabul qiladi, ya'ni isbotsiz qolgan so'rov `APPROVED`
   * ga HECH QACHON o'ta olmasdi va 24 soatdan keyin CRON uni `VOID` qilardi.
   * Buyurtma allaqachon sotilgani uchun kuryer qayta so'rov ham yarata
   * olmasdi (`UQ_ECR_ORDER_OPEN`) — ya'ni pul 100% yo'qolardi.
   *
   * ATOMIK: status o'zgarishi birinchi amal. Ikki qurilmadan bir vaqtda
   * biriktirilsa, ikkinchisi 409 oladi va isbotlar ikki marta bog'lanmaydi.
   */
  async attachProof(
    queryRunner: QueryRunner,
    params: { requestId: string; courierId: string; proofIds: string[] },
  ): Promise<ExtraCostRequestEntity> {
    const proofs = await this.proofService.validateOwnedUnbound(
      params.proofIds,
      params.courierId,
    );
    if (!proofs.length) {
      throw new BadRequestException('Kamida bitta isbot biriktiring');
    }

    const now = Date.now();
    const gate = await queryRunner.manager
      .createQueryBuilder()
      .update(ExtraCostRequestEntity)
      .set({ status: ExtraCostStatus.PENDING, updated_at: now })
      .where('id = :id', { id: params.requestId })
      // Egalik SO'ROV ICHIDA — boshqa kuryerning so'roviga isbot
      // biriktirib bo'lmaydi.
      .andWhere('courier_id = :cid', { cid: params.courierId })
      .andWhere('status = :s', { s: ExtraCostStatus.AWAITING_PROOF })
      .execute();

    if (!gate.affected) {
      throw new ConflictException(
        "So'rov topilmadi yoki isbot kutish muddati o'tgan " +
          "(24 soat). Bu xarajat endi tasdiqlab bo'lmaydi.",
      );
    }

    const req = await queryRunner.manager.findOne(ExtraCostRequestEntity, {
      where: { id: params.requestId },
    });
    if (!req) throw new NotFoundException("So'rov topilmadi");

    req.proof_ids = proofs.map((p) => p.id);
    await queryRunner.manager.save(ExtraCostRequestEntity, req);

    await queryRunner.manager.update(
      ExtraCostProofEntity,
      { id: In(proofs.map((p) => p.id)) },
      { request_id: req.id, bound_at: now },
    );
    await this.refreshDupCount(queryRunner, req, proofs);

    return req;
  }

  /**
   * OCHIQ so'rovlarni bekor qiladi (rollback / qayta jo'natish / kuryer
   * almashtirish).
   *
   * ⚠️ ROLLBACK'NING ENG BOSHIDA chaqirilishi SHART — kassa bloklaridan
   * OLDIN. Aks holda poyga oynasi ochiladi: `reverseExtraCostForCashbox`
   * hali ko'rinmagan (commit qilinmagan) `EXTRA_COST` qatorlarini ko'rmay
   * `net = 0` deb hisoblaydi, keyin void 0 qator o'zgartiradi — natijada
   * PUL YOZILGAN, LEKIN QAYTARILMAGAN holat qoladi.
   *
   * Bekor qilingan so'rovlar sonini qaytaradi.
   */
  async voidOpenRequests(
    queryRunner: QueryRunner,
    orderId: string,
    reason: string,
  ): Promise<number> {
    const now = Date.now();
    const res = await queryRunner.manager
      .createQueryBuilder()
      .update(ExtraCostRequestEntity)
      .set({
        status: ExtraCostStatus.VOID,
        decision_mode: ExtraCostDecisionMode.SYSTEM_VOID,
        review_note: reason,
        voided_at: now,
        updated_at: now,
      })
      .where('order_id = :orderId', { orderId })
      .andWhere('status IN (:...open)', {
        open: [ExtraCostStatus.AWAITING_PROOF, ExtraCostStatus.PENDING],
      })
      .execute();
    return res.affected ?? 0;
  }

  /**
   * TASDIQLANGAN so'rovlarni "teskari qaytarilgan" deb belgilaydi.
   *
   * ⚠️ KASSA BLOKLARIDAN KEYIN chaqiriladi. Pulni `reverseExtraCostForCashbox`
   * o'zi qaytaradi (net-balans bo'yicha) — bu yerda faqat so'rov holati
   * yangilanadi, ya'ni market/kuryer sahifasida "teskari qaytarildi" deb
   * ko'rinadi va u endi hisobda turmaydi.
   */
  async markReversed(
    queryRunner: QueryRunner,
    orderId: string,
    reason: string,
  ): Promise<number> {
    const now = Date.now();
    const res = await queryRunner.manager
      .createQueryBuilder()
      .update(ExtraCostRequestEntity)
      .set({
        status: ExtraCostStatus.REVERSED,
        review_note: reason,
        updated_at: now,
      })
      .where('order_id = :orderId', { orderId })
      .andWhere('status = :approved', {
        approved: ExtraCostStatus.APPROVED,
      })
      .execute();
    return res.affected ?? 0;
  }

  /**
   * Buyurtmada OCHIQ so'rov bormi.
   *
   * `UQ_ECR_ORDER_OPEN` partial-unique indeksi bu holatni DB darajasida ham
   * to'sadi, lekin indeks OXIRGI devor: u 500 xato beradi, bu tekshiruv esa
   * kuryerga tushunarli o'zbekcha xabar.
   */
  async hasOpenRequest(
    queryRunner: QueryRunner,
    orderId: string,
  ): Promise<boolean> {
    const count = await queryRunner.manager.count(ExtraCostRequestEntity, {
      where: [
        { order_id: orderId, status: ExtraCostStatus.PENDING },
        { order_id: orderId, status: ExtraCostStatus.AWAITING_PROOF },
      ],
    });
    return count > 0;
  }
}
