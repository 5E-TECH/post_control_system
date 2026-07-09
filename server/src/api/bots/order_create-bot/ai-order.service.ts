import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ProductEntity } from 'src/core/entity/product.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { OrderService } from 'src/api/order/order.service';
import { ClaudeService } from 'src/infrastructure/ai/claude.service';
import { AiBalanceService } from 'src/api/ai-balance/ai-balance.service';
import { MyLogger } from 'src/logger/logger.service';
import { Roles, Where_deliver, Order_status } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { CreateOrderByBotDto } from 'src/api/order/dto/create-order-bot.dto';
import { CreateOrderDto } from 'src/api/order/dto/create-order.dto';
import { AiDraftItem, AiOrderDraft } from './session.interface';

const MAX_CANDIDATE_BUTTONS = 5;

const EXTRACT_SYSTEM = `Sen O'zbekistondagi yetkazib berish platformasining buyurtma yordamchisisan.
Foydalanuvchi (operator yoki market) yozgan yoki mijozdan forward qilingan erkin matndan buyurtma ma'lumotlarini ajratasan.
QAT'IY QOIDALAR:
- Faqat matnda ANIQ bor ma'lumotni chiqar. Yo'q bo'lsa null qoldiring — HECH NARSA TO'QIB CHIQARMA.
- Mahsulotlar uchun faqat NOMINI va sonini (quantity) yoz; ID/narx to'qima. Son ko'rsatilmagan bo'lsa 1.
- region_name = VILOYAT nomi (masalan "Andijon", "Navoiy", "Toshkent"). Faqat matnda aniq bo'lsa; bo'lmasa null.
- district_name = yetkazish JOYI — TUMAN yoki SHAHAR nomi (masalan "Asaka", "Chilonzor", "Navoiy shahri", "Zarafshon shahri", "Nurota"). MUHIM: joy manzil ichida bo'lsa ham (masalan "Navoiy shahri vagzal xududi 20-uy") — shahar/tuman nomini ("Navoiy shahri") ajratib district_name'ga yoz, faqat qolgan ko'cha/uy qismini ("vagzal xududi 20-uy") address'ga yoz. SHAHAR ham district_name'ga tushadi, address'ga EMAS.
- total_price = butun buyurtma narxi RAQAM sifatida (masalan "250 ming" -> 250000, "2.5 mln" -> 2500000). Aniq bo'lmasa null.
- comment = yetkazish bo'yicha izoh (masalan "kechqurun keling"). Telefon raqamlar comment'ga tushmasin.
- Telefon O'zbekiston formatida; faqat raqamlarni ol.
- extra_number = mijozning IKKINCHI (qo'shimcha) telefon raqami, agar bo'lsa.
- where_deliver = yetkazish turi: "address" (uyga/manzilga yetkazilsa, "eshikkacha", "uyiga"), "center" (markazdan/pochtadan/filialdan olib ketsa yoki "olib ketadi"). Aniq bo'lmasa null.
- is_replacement = true FAQAT matn ALMASHTIRISH/kafolat holatini bildirsa: "almashtirish", "almashtirib berish", "kafolat", "brak", "nosoz", "buzuq", "ishlamayapti", "eski ... o'rniga", "qaytarib olib yangisini". Oddiy yangi buyurtma bo'lsa false.
- operator = MUTAXASSIS / operator / sotuvchi ismi, agar matnda ko'rsatilgan bo'lsa (masalan "Mutaxassis: #sevinch" -> "sevinch", "operator Ali" -> "Ali"). '#' belgisini olib tashla. Yo'q bo'lsa null.
Matn o'zbek, rus yoki lotin/kirill aralash bo'lishi mumkin.`;

const EXTRACT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    customer_name: { type: ['string', 'null'] },
    phone_number: { type: ['string', 'null'] },
    extra_number: { type: ['string', 'null'] },
    region_name: { type: ['string', 'null'] },
    district_name: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          quantity: { type: 'integer' },
        },
        required: ['name', 'quantity'],
      },
    },
    total_price: { type: ['number', 'null'] },
    comment: { type: ['string', 'null'] },
    where_deliver: { type: ['string', 'null'] },
    is_replacement: { type: 'boolean' },
    operator: { type: ['string', 'null'] },
  },
  required: [
    'customer_name',
    'phone_number',
    'extra_number',
    'region_name',
    'district_name',
    'address',
    'items',
    'total_price',
    'comment',
    'where_deliver',
    'is_replacement',
    'operator',
  ],
};

interface RawExtraction {
  customer_name: string | null;
  phone_number: string | null;
  extra_number: string | null;
  region_name: string | null;
  district_name: string | null;
  address: string | null;
  items: { name: string; quantity: number }[];
  total_price: number | null;
  comment: string | null;
  where_deliver: string | null;
  is_replacement: boolean;
  operator: string | null;
}

// Ko'p buyurtma: bitta matnda bir nechta buyurtma bo'lishi mumkin.
const EXTRACT_MULTI_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    orders: {
      type: 'array',
      items: EXTRACT_SCHEMA,
    },
  },
  required: ['orders'],
};

const EXTRACT_MULTI_SYSTEM = `${EXTRACT_SYSTEM}

DIQQAT: Matnda BIR NECHTA buyurtma bo'lishi mumkin (har xil mijozlar / alohida buyurtmalar). Har bir ALOHIDA buyurtmani "orders" massivida alohida element qilib qaytar. Agar matnda bitta buyurtma bo'lsa — massivda bitta element bo'ladi. Buyurtmalar bo'sh qatorlar, raqamlash (1., 2., -) yoki har xil mijoz nomi/telefoni bilan ajralishi mumkin. Bitta mijozning bir nechta mahsulotini AJRATMA — u bitta buyurtma.`;

export interface OrderPreviewItem {
  name: string;
  quantity: number;
  product_id?: string;
  resolved_name?: string;
  candidates?: { id: string; name: string }[];
}

export interface OrderPreview {
  customer_name?: string;
  phone_number?: string;
  extra_number?: string;
  district_id?: string;
  district_name?: string; // DB'dagi tuman/shahar nomi
  region_id?: string;
  region_name?: string; // DB'dagi viloyat nomi
  region_given?: boolean; // matnda viloyat bor edimi (xabar uchun)
  district_candidates?: {
    id: string;
    label: string;
    region_name?: string;
    district_name?: string;
  }[];
  address?: string;
  items: OrderPreviewItem[];
  total_price?: number;
  comment?: string;
  operator?: string;
  where_deliver?: 'center' | 'address';
  is_replacement?: boolean;
  replaced_order_id?: string;
  replacement_candidates?: {
    id: string;
    order_number: number;
    created_at: number;
    total_price: number;
    items: string;
  }[];
  ready: boolean;
  issues: string[];
}

export interface ConfirmedOrder {
  customer_name: string;
  phone_number: string;
  extra_number?: string;
  district_id: string;
  address?: string;
  order_item_info: { product_id: string; quantity: number }[];
  total_price: number;
  comment?: string;
  operator?: string;
  where_deliver?: Where_deliver;
  replaced_order_id?: string;
}

export interface ResolvedOperator {
  user: UserEntity;
  marketId: string;
  jwt: JwtPayload;
}

@Injectable()
export class AiOrderService {
  constructor(
    private readonly claude: ClaudeService,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(DistrictEntity)
    private readonly districtRepo: Repository<DistrictEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly aiBalance: AiBalanceService,
    private readonly logger: MyLogger,
  ) {}

  isEnabled(): boolean {
    return this.claude.isEnabled();
  }

  // ─── Platforma (web) uchun: matndan AI buyurtma yaratish ───
  // Foydalanuvchi roliga qarab marketni aniqlab, balansdan yechadi (ozod
  // rollar bepul), extract+resolve qiladi; to'liq bo'lsa yangi customer +
  // createOrder (status NEW). To'liqsiz/xato bo'lsa pul qaytariladi.
  async createForPlatform(
    text: string,
    user: JwtPayload,
    bodyMarketId?: string,
  ): Promise<{
    ok: boolean;
    reason?: string;
    order?: unknown;
    balance?: number;
    price?: number;
    missing?: string[];
    draft?: Record<string, unknown>;
  }> {
    if (!this.isEnabled()) return { ok: false, reason: 'ai_off' };

    // Market aniqlash
    let marketId: string | undefined;
    if (user.role === Roles.MARKET) {
      marketId = user.id;
    } else if (user.role === Roles.OPERATOR) {
      const op = await this.userRepo.findOne({ where: { id: user.id } });
      marketId = op?.market_id || undefined;
    } else {
      marketId = bodyMarketId; // admin/registrator/superadmin market tanlaydi
    }
    if (!marketId) return { ok: false, reason: 'no_market' };

    // Balansdan yechish (ozod rollar bepul)
    const exempt = this.aiBalance.isExemptRole(user.role as Roles);
    let charge: { reason: string; balance: number; price: number } | null =
      null;
    if (!exempt) {
      charge = await this.aiBalance.chargeForOrder(marketId, { actor: user.id });
      if (charge.reason !== 'ok') {
        return {
          ok: false,
          reason: charge.reason,
          balance: charge.balance,
          price: charge.price,
        };
      }
    }

    const draft = await this.extractDraft(text);
    if (!draft) {
      if (charge)
        await this.aiBalance.refund(marketId, charge.price, { actor: user.id });
      return { ok: false, reason: 'ai_error' };
    }
    await this.resolveDraft(draft, marketId);

    const missing = this.missingRequired(draft);
    const next = this.firstUnresolved(draft);
    if (missing.length || next) {
      // to'liq emas — pul qaytariladi, foydalanuvchi aniqlashtiradi
      if (charge)
        await this.aiBalance.refund(marketId, charge.price, { actor: user.id });
      return {
        ok: false,
        reason: 'incomplete',
        missing,
        draft: this.publicDraft(draft),
      };
    }

    // To'liq — yangi customer + createOrder (status NEW)
    const customer = await this.userRepo.save(
      this.userRepo.create({
        name: draft.customer_name,
        phone_number: draft.phone_number,
        extra_number: draft.extra_number,
        district_id: draft.district_id,
        address: draft.address,
        role: Roles.CUSTOMER,
      }),
    );

    try {
      const dto: CreateOrderDto = {
        customer_id: customer.id,
        market_id: marketId,
        order_item_info: draft.items.map((i) => ({
          product_id: i.product_id as string,
          quantity: i.quantity,
        })),
        total_price: draft.total_price as number,
        district_id: draft.district_id,
        comment: draft.comment,
        where_deliver: Where_deliver.CENTER,
      } as CreateOrderDto;

      const order = await this.orderService.createOrder(dto, user);
      return { ok: true, order, balance: charge?.balance };
    } catch (err) {
      // createOrder xato berdi (masalan add_order o'chiq / operator telefoni
      // majburiy) — orphan customer'ni tozalab, yechilgan pulni qaytaramiz.
      try {
        await this.userRepo.delete(customer.id);
      } catch {
        /* ignore */
      }
      if (charge) {
        await this.aiBalance.refund(marketId, charge.price, { actor: user.id });
      }
      this.logger.log(
        `createForPlatform createOrder xato: ${(err as Error).message}`,
        'AiOrder',
      );
      return { ok: false, reason: 'create_failed' };
    }
  }

  // Platforma: joriy foydalanuvchi uchun AI mavjudmi (market uchun balans
  // tekshiriladi; admin/registrator ozod — doim mavjud).
  async aiAvailabilityForUser(user: JwtPayload): Promise<{
    available: boolean;
    exempt?: boolean;
    enabled?: boolean;
    balance?: number;
    price?: number;
    reason?: string;
  }> {
    if (!this.isEnabled()) return { available: false, reason: 'ai_off' };
    if (this.aiBalance.isExemptRole(user.role as Roles)) {
      return { available: true, exempt: true };
    }
    let marketId: string | undefined;
    if (user.role === Roles.MARKET) {
      marketId = user.id;
    } else if (user.role === Roles.OPERATOR) {
      const op = await this.userRepo.findOne({ where: { id: user.id } });
      marketId = op?.market_id || undefined;
    }
    if (!marketId) return { available: false, reason: 'no_market' };
    const state = await this.aiBalance.getState(marketId);
    if (!state) return { available: false, reason: 'no_market' };
    const available = state.enabled && state.balance >= state.price;
    return {
      available,
      enabled: state.enabled,
      balance: state.balance,
      price: state.price,
      reason: available ? undefined : !state.enabled ? 'disabled' : 'insufficient',
    };
  }

  // Frontend'ga ko'rsatish uchun draftning ochiq versiyasi
  private publicDraft(draft: AiOrderDraft): Record<string, unknown> {
    return {
      customer_name: draft.customer_name,
      phone_number: draft.phone_number,
      district_label: draft.district_label,
      district_resolved: !!draft.district_id,
      district_candidates: draft.district_candidates,
      items: draft.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        resolved_name: i.resolved_name,
        resolved: !!i.product_id,
        candidates: i.candidates,
      })),
      total_price: draft.total_price,
      comment: draft.comment,
    };
  }

  // ─── Operator/market'ni telegram_id bo'yicha aniqlash ───
  async resolveOperator(
    telegramId: number | undefined,
  ): Promise<ResolvedOperator | null> {
    if (!telegramId) return null;
    const user = await this.userRepo.findOne({
      where: { telegram_id: telegramId, is_deleted: false },
    });
    if (!user) return null;
    if (user.role !== Roles.MARKET && user.role !== Roles.OPERATOR) return null;

    const marketId = user.role === Roles.MARKET ? user.id : user.market_id;
    if (!marketId) return null;

    return {
      user,
      marketId,
      jwt: { id: user.id, role: user.role, status: user.status },
    };
  }

  // ─── 1-faza: EKSTRAKSIYA (Claude, faqat nomlar) ───
  async extractDraft(text: string): Promise<AiOrderDraft | null> {
    const raw = await this.claude.extractJson<RawExtraction>({
      system: EXTRACT_SYSTEM,
      userText: text,
      schema: EXTRACT_SCHEMA,
    });
    if (!raw) return null;
    return this.rawToDraft(raw);
  }

  private rawToDraft(raw: RawExtraction): AiOrderDraft {
    const items: AiDraftItem[] = (raw.items || [])
      .filter((i) => i && typeof i.name === 'string' && i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
      }));

    return {
      nonce: randomBytes(4).toString('hex'),
      customer_name: raw.customer_name?.trim() || undefined,
      phone_number: this.normalizePhone(raw.phone_number),
      extra_number: this.normalizePhone(raw.extra_number),
      region_name: raw.region_name?.trim() || undefined,
      district_name: raw.district_name?.trim() || undefined,
      address: raw.address?.trim() || undefined,
      items,
      total_price:
        raw.total_price != null && Number(raw.total_price) > 0
          ? Math.round(Number(raw.total_price))
          : undefined,
      comment: raw.comment?.trim() || undefined,
      where_deliver:
        raw.where_deliver === 'address'
          ? 'address'
          : raw.where_deliver === 'center'
            ? 'center'
            : undefined,
      is_replacement: raw.is_replacement === true,
      operator: raw.operator?.replace(/^#+/, '').trim() || undefined,
    };
  }

  // ─── Ko'p buyurtma: matndan BIR NECHTA buyurtmani ajratib, har birini
  //     rezolyutsiya qiladi va tasdiqlash uchun preview qaytaradi (charge YO'Q).
  async parseOrders(
    text: string,
    marketId: string,
    defaultTariff?: Where_deliver,
  ): Promise<OrderPreview[]> {
    const res = await this.claude.extractJson<{ orders: RawExtraction[] }>({
      system: EXTRACT_MULTI_SYSTEM,
      userText: text,
      schema: EXTRACT_MULTI_SCHEMA,
      maxTokens: 3000,
    });
    if (!res || !Array.isArray(res.orders)) return [];

    // Yetkazish turi — MARKET default'iga qarab (AI taxminiga emas).
    const marketDefault: 'center' | 'address' =
      defaultTariff === Where_deliver.ADDRESS ? 'address' : 'center';

    const previews: OrderPreview[] = [];
    for (const raw of res.orders) {
      const draft = this.rawToDraft(raw);
      if (!draft.customer_name && !draft.phone_number && !draft.items.length) {
        continue; // bo'sh element
      }
      draft.where_deliver = marketDefault; // market default (operator kartada o'zgartiradi)
      await this.resolveDraft(draft, marketId);
      if (draft.is_replacement) {
        await this.resolveReplacement(draft, marketId);
      }
      previews.push(this.toPreview(draft));
    }
    return previews;
  }

  // Almashtirish: telefon bo'yicha shu marketning SOTILGAN eski buyurtmalarini
  // topib, eng so'nggisini avto-tanlaydi (operator tasdiqlaydi/o'zgartiradi).
  private async resolveReplacement(
    draft: AiOrderDraft,
    marketId: string,
  ): Promise<void> {
    const phone9 = (draft.phone_number || '').replace(/\D/g, '').slice(-9);
    if (phone9.length < 9) return; // to'liq 9 raqam bo'lsagina ishonchli qidiruv

    const DELIVERED = [
      Order_status.SOLD,
      Order_status.PAID,
      Order_status.PARTLY_PAID,
      Order_status.CLOSED,
    ];
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoin('o.customer', 'customer')
      .where('o.user_id = :m', { m: marketId })
      .andWhere('o.deleted_at IS NULL')
      .andWhere('o.is_replacement_return = false')
      .andWhere('o.status IN (:...s)', { s: DELIVERED })
      // Saqlangan telefon ajratuvchili bo'lishi mumkin (+998 90 111 22 33) —
      // faqat raqamlarni qoldirib solishtiramiz.
      .andWhere(
        "regexp_replace(customer.phone_number, '[^0-9]', '', 'g') LIKE :q",
        { q: `%${phone9}%` },
      )
      .orderBy('o.created_at', 'DESC')
      .take(10)
      .getMany();

    if (!rows.length) return;

    draft.replacement_candidates = rows.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      created_at: Number(o.created_at),
      total_price: Number(o.total_price) || 0,
      items: (o.items || [])
        .map((it) => `${it.product?.name || 'mahsulot'} x${it.quantity}`)
        .join(', '),
    }));
    // Eng so'nggisini avto-tanlaymiz (operator kartada o'zgartira oladi)
    draft.replaced_order_id = rows[0].id;
  }

  private toPreview(draft: AiOrderDraft): OrderPreview {
    const issues: string[] = [];
    if (!draft.customer_name) issues.push("mijoz ismi yo'q");
    if (!draft.phone_number) issues.push("telefon yo'q");
    if (!draft.district_id) {
      if (draft.district_candidates?.length) {
        issues.push('tuman/shahar tanlang');
      } else if (draft.region_name) {
        // Viloyat berilgan, lekin tuman/shahar aniqlanmagan
        issues.push('shahar/tuman kiritilmagan');
      } else {
        issues.push('tuman/shahar topilmadi');
      }
    }
    // Almashtirish buyurtmasi narxi 0 bo'lishi mumkin (eski buyurtma o'rniga);
    // oddiy buyurtma uchun narx > 0 bo'lishi shart.
    if (draft.is_replacement) {
      if (draft.total_price == null) issues.push("narx yo'q (0 bo'lsa 0 yozing)");
    } else if (draft.total_price == null || draft.total_price <= 0) {
      issues.push("narx yo'q");
    }
    if (!draft.items.length) issues.push("mahsulot yo'q");
    draft.items.forEach((it) => {
      if (!it.product_id) {
        issues.push(
          `"${it.name}" ${it.candidates?.length ? 'aniqlanmagan' : "katalogda yo'q"}`,
        );
      }
    });

    return {
      customer_name: draft.customer_name,
      phone_number: draft.phone_number,
      extra_number: draft.extra_number,
      district_id: draft.district_id,
      district_name: draft.district_resolved_name,
      region_id: draft.region_id,
      region_name: draft.region_label,
      region_given: !!draft.region_name,
      district_candidates: draft.district_candidates,
      address: draft.address,
      items: draft.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        product_id: i.product_id,
        resolved_name: i.resolved_name,
        candidates: i.candidates,
      })),
      total_price: draft.total_price,
      comment: draft.comment,
      operator: draft.operator,
      where_deliver: draft.where_deliver,
      is_replacement: draft.is_replacement,
      replaced_order_id: draft.replaced_order_id,
      replacement_candidates: draft.replacement_candidates,
      ready: issues.length === 0,
      issues,
    };
  }

  // Parse endpoint uchun: marketni aniqlab, AI mavjudligini tekshirib parseOrders.
  async parseForUser(
    text: string,
    user: JwtPayload,
    bodyMarketId?: string,
  ): Promise<{
    ok: boolean;
    reason?: string;
    orders?: OrderPreview[];
    balance?: number;
    price?: number;
  }> {
    if (!this.isEnabled()) return { ok: false, reason: 'ai_off' };
    const marketId = await this.resolveMarketId(user, bodyMarketId);
    if (!marketId) return { ok: false, reason: 'no_market' };

    if (!this.aiBalance.isExemptRole(user.role as Roles)) {
      const state = await this.aiBalance.getState(marketId);
      if (!state || !state.enabled) return { ok: false, reason: 'disabled' };
      if (state.balance < state.price) {
        return {
          ok: false,
          reason: 'insufficient',
          balance: state.balance,
          price: state.price,
        };
      }
    }

    // Market default yetkazish tarifi
    const marketRow = await this.userRepo.findOne({ where: { id: marketId } });
    const orders = await this.parseOrders(
      text,
      marketId,
      marketRow?.default_tariff,
    );
    if (!orders.length) return { ok: false, reason: 'ai_error' };
    return { ok: true, orders };
  }

  // Tasdiqlangan buyurtmalarni yaratish (har biriga alohida charge + create).
  async createConfirmedOrders(
    orders: ConfirmedOrder[],
    user: JwtPayload,
    bodyMarketId?: string,
  ): Promise<{
    results: {
      ok: boolean;
      reason?: string;
      order_number?: number;
      balance?: number;
      customer_name?: string;
    }[];
  }> {
    const marketId = await this.resolveMarketId(user, bodyMarketId);
    if (!marketId) {
      return {
        results: orders.map((o) => ({
          ok: false,
          reason: 'no_market',
          customer_name: o.customer_name,
        })),
      };
    }
    const exempt = this.aiBalance.isExemptRole(user.role as Roles);
    const results: {
      ok: boolean;
      reason?: string;
      order_number?: number;
      balance?: number;
      customer_name?: string;
    }[] = [];
    // Partiya ichida bir xil buyurtma ikki marta charge/yaratilmasin (dublikat
    // qatorlar) — imzo faqat MUVAFFAQIYATLI yaratilgach belgilanadi.
    const created = new Set<string>();
    // Kvitansiya uchun market default operator telefoni (mavjud bo'lsa).
    const marketRow = await this.userRepo.findOne({ where: { id: marketId } });
    const defaultOperatorPhone =
      marketRow?.default_operator_phone?.trim() || undefined;

    for (const o of orders) {
      const sig = this.orderSignature(o);
      if (created.has(sig)) {
        results.push({
          ok: false,
          reason: 'duplicate',
          customer_name: o.customer_name,
        });
        continue;
      }

      // Oddiy (almashtirish EMAS) buyurtma narxi > 0 bo'lishi shart — 0-som
      // buyurtma yaratilib pul yechilib qolmasin.
      if (
        !o.replaced_order_id &&
        (o.total_price == null || o.total_price < 1)
      ) {
        results.push({
          ok: false,
          reason: 'invalid_price',
          customer_name: o.customer_name,
        });
        continue;
      }

      let charge: { reason: string; balance: number; price: number } | null =
        null;
      if (!exempt) {
        charge = await this.aiBalance.chargeForOrder(marketId, {
          actor: user.id,
        });
        if (charge.reason !== 'ok') {
          results.push({
            ok: false,
            reason: charge.reason,
            balance: charge.balance,
            customer_name: o.customer_name,
          });
          continue;
        }
      }

      // Charge'dan keyingi HAMMA narsa (customer.save + createOrder) himoyalangan:
      // istalgan xato bo'lsa pul qaytariladi, orphan o'chiriladi, loop TO'XTAMAYDI.
      let customerId: string | undefined;
      try {
        const customer = await this.userRepo.save(
          this.userRepo.create({
            name: o.customer_name,
            phone_number: o.phone_number,
            extra_number: o.extra_number,
            district_id: o.district_id,
            address: o.address,
            role: Roles.CUSTOMER,
          }),
        );
        customerId = customer.id;

        const dto: CreateOrderDto = {
          customer_id: customer.id,
          market_id: marketId,
          order_item_info: o.order_item_info,
          total_price: o.total_price,
          district_id: o.district_id,
          comment: o.comment,
          where_deliver:
            o.where_deliver ?? marketRow?.default_tariff ?? Where_deliver.CENTER,
          operator: o.operator,
          operator_phone: defaultOperatorPhone,
          replaced_order_id: o.replaced_order_id,
        } as CreateOrderDto;
        const res = (await this.orderService.createOrder(dto, user)) as {
          data?: { order_number?: number };
        };
        created.add(sig);
        results.push({
          ok: true,
          order_number: res?.data?.order_number,
          balance: charge?.balance,
          customer_name: o.customer_name,
        });
      } catch (err) {
        if (customerId) {
          try {
            await this.userRepo.delete(customerId);
          } catch {
            /* ignore */
          }
        }
        if (charge) {
          await this.aiBalance.refund(marketId, charge.price, {
            actor: user.id,
          });
        }
        this.logger.log(
          `createConfirmedOrders xato: ${(err as Error).message}`,
          'AiOrder',
        );
        results.push({
          ok: false,
          reason: 'create_failed',
          customer_name: o.customer_name,
        });
      }
    }
    return { results };
  }

  // Buyurtma imzosi (partiya ichi dublikat aniqlash): telefon(oxirgi 9)+mahsulotlar
  // +narx+almashtirilayotgan eski buyurtma. replaced_order_id imzoga kiradi —
  // aks holda bir mijozning bir xil mahsulotli (narx 0) IKKI almashtirishi bitta
  // deb sanalib, ikkinchisi yaratilmay qolardi.
  private orderSignature(o: ConfirmedOrder): string {
    const phone = (o.phone_number || '').replace(/\D/g, '').slice(-9);
    const items = (o.order_item_info || [])
      .map((i) => `${i.product_id}:${i.quantity}`)
      .sort()
      .join(',');
    return `${phone}|${items}|${o.total_price}|${o.replaced_order_id ?? ''}`;
  }

  private async resolveMarketId(
    user: JwtPayload,
    bodyMarketId?: string,
  ): Promise<string | undefined> {
    if (user.role === Roles.MARKET) return user.id;
    if (user.role === Roles.OPERATOR) {
      const op = await this.userRepo.findOne({ where: { id: user.id } });
      return op?.market_id || undefined;
    }
    return bodyMarketId;
  }

  // Barcha viloyat + tuman/shaharlar (AI karta Select'lari uchun) — bitta so'rov.
  async getGeo(): Promise<{
    regions: { id: string; name: string }[];
    districts: { id: string; name: string; region_id: string }[];
  }> {
    const districts = await this.districtRepo.find({ relations: ['region'] });
    const regionsMap = new Map<string, { id: string; name: string }>();
    const outDistricts = districts.map((d) => {
      if (d.region) {
        regionsMap.set(d.region_id, { id: d.region_id, name: d.region.name });
      }
      return { id: d.id, name: d.name, region_id: d.region_id };
    });
    const regions = [...regionsMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    outDistricts.sort((a, b) => a.name.localeCompare(b.name));
    return { regions, districts: outDistricts };
  }

  // ─── 2-faza: REZOLYUTSIYA (DETERMINISTIK DB moslash) ───
  async resolveDraft(
    draft: AiOrderDraft,
    marketId: string,
  ): Promise<AiOrderDraft> {
    await this.resolveDistrict(draft);
    await this.resolveItems(draft, marketId);
    return draft;
  }

  private async resolveDistrict(draft: AiOrderDraft): Promise<void> {
    const districts = await this.districtRepo.find({ relations: ['region'] });

    // 0. VILOYATNI mustaqil aniqlaymiz (tuman topilmasa ham viloyat qolsin).
    if (draft.region_name) {
      const rq = this.normGeo(draft.region_name);
      const regions = new Map<string, { id: string; name: string }>();
      for (const d of districts) {
        if (d.region) regions.set(d.region_id, { id: d.region_id, name: d.region.name });
      }
      let region = [...regions.values()].find(
        (r) => this.normGeo(r.name) === rq,
      );
      if (!region) {
        region = [...regions.values()].find((r) => {
          const rn = this.normGeo(r.name);
          return rn.length > 2 && (rn.includes(rq) || rq.includes(rn));
        });
      }
      if (region) {
        draft.region_id = region.id;
        draft.region_label = region.name;
      }
    }

    // 1-usul: district_name bo'yicha (aniq base-nom, keyin qism-mos).
    let matches: DistrictEntity[] = [];
    if (draft.district_name) {
      const q = this.normGeo(draft.district_name);
      if (q) {
        matches = districts.filter((d) => this.normGeo(d.name) === q);
        if (!matches.length) {
          matches = districts.filter((d) => {
            const dn = this.normGeo(d.name);
            return dn.length > 2 && (dn.includes(q) || q.includes(dn));
          });
        }
      }
    }

    // 2-usul (FALLBACK): district_name topilmadi/bo'sh bo'lsa — LLM shaharni
    // address'ga qo'yib yuborgan bo'lishi mumkin. DB'dagi tuman/shahar nomini
    // (district_name + address) matnidan qidiramiz. region_name QO'SHILMAYDI —
    // shunda "faqat viloyat berilgan" holat topilmasdan qoladi (kerakli xatti-harakat).
    if (!matches.length) {
      const corpus = this.normGeo(
        `${draft.district_name || ''} ${draft.address || ''}`,
      );
      if (corpus) {
        const padded = ` ${corpus} `;
        const found = districts
          .map((d) => ({ d, dn: this.normGeo(d.name) }))
          .filter((x) => x.dn.length >= 4 && padded.includes(` ${x.dn} `))
          .sort((a, b) => b.dn.length - a.dn.length);
        if (found.length) {
          const maxLen = found[0].dn.length;
          matches = found.filter((x) => x.dn.length === maxLen).map((x) => x.d);
        }
      }
    }

    // Viloyat aniqlangan bo'lsa — shu viloyatga cheklab aniqlashtirish.
    if (draft.region_id && matches.length > 1) {
      const inRegion = matches.filter((d) => d.region_id === draft.region_id);
      if (inRegion.length > 0) matches = inRegion;
    }

    const toLabel = (d: DistrictEntity) =>
      d.region?.name ? `${d.region.name}, ${d.name}` : d.name;

    if (matches.length === 1) {
      const d = matches[0];
      draft.district_id = d.id;
      draft.district_resolved_name = d.name;
      draft.region_id = d.region_id; // tuman viloyatini aniq bilamiz
      draft.region_label = d.region?.name || draft.region_label;
      draft.district_label = toLabel(d);
      draft.district_candidates = undefined;
    } else if (matches.length > 1) {
      // Tuman noaniq — lekin VILOYATni (0-bosqichda aniqlangan) saqlaymiz.
      draft.district_id = undefined;
      draft.district_resolved_name = undefined;
      draft.district_candidates = matches
        .slice(0, MAX_CANDIDATE_BUTTONS)
        .map((d) => ({
          id: d.id,
          label: toLabel(d),
          region_name: d.region?.name || undefined,
          district_name: d.name,
        }));
    } else {
      // Tuman topilmadi — viloyat (agar aniqlangan bo'lsa) saqlanadi.
      draft.district_id = undefined;
      draft.district_resolved_name = undefined;
      draft.district_candidates = [];
    }
  }

  private async resolveItems(
    draft: AiOrderDraft,
    marketId: string,
  ): Promise<void> {
    if (!draft.items.length) return;

    const catalog = await this.productRepo.find({
      where: { user_id: marketId, isDeleted: false },
    });

    for (const item of draft.items) {
      const ranked = this.rankProducts(item.name, catalog);

      // Avto-tanlash faqat ANIQ TENG nom (1.0) yoki aniq ustun (>=0.85, ikkinchi
      // nomzoddan ancha oldinda) bo'lganda. Substring/token mosligi (< 0.85)
      // hech qachon avto-tanlanmaydi — operator tasdiqlaydi (semantik xato
      // mahsulotni jimgina o'tkazib yubormaslik uchun).
      if (
        ranked.length &&
        ((ranked[0].score === 1 &&
          (ranked.length === 1 || ranked[1].score < 1)) ||
          (ranked[0].score >= 0.85 &&
            (ranked.length === 1 || ranked[0].score - ranked[1].score >= 0.2)))
      ) {
        item.product_id = ranked[0].product.id;
        item.resolved_name = ranked[0].product.name;
        item.candidates = undefined;
      } else {
        item.product_id = undefined;
        item.resolved_name = undefined;
        item.candidates = ranked
          .slice(0, MAX_CANDIDATE_BUTTONS)
          .map((r) => ({ id: r.product.id, name: r.product.name }));
      }
    }
  }

  private rankProducts(
    query: string,
    catalog: ProductEntity[],
  ): { product: ProductEntity; score: number }[] {
    const q = this.normalizeProduct(query);
    if (!q) return [];
    const qTokens = new Set(q.split(' ').filter(Boolean));

    return catalog
      .map((product) => {
        const p = this.normalizeProduct(product.name);
        let score = 0;
        if (p === q) score = 1;
        // Substring < avto-chegara (0.85): nomzod sifatida ko'rinadi, lekin
        // qo'shimcha token boshqa SKU bo'lishi mumkin — avto-tanlanmaydi.
        else if (p.includes(q) || q.includes(p)) score = 0.8;
        else {
          const pTokens = new Set(p.split(' ').filter(Boolean));
          const inter = [...qTokens].filter((t) => pTokens.has(t)).length;
          const union = new Set([...qTokens, ...pTokens]).size || 1;
          score = inter / union; // Jaccard
        }
        return { product, score };
      })
      .filter((r) => r.score >= 0.34)
      .sort((a, b) => b.score - a.score);
  }

  private normalizeProduct(s: string): string {
    return (s || '')
      .toLowerCase()
      .trim()
      .normalize('NFKC')
      .replace(/[`ʼʻ']/g, "'")
      .replace(/\b(dona|ta|шт|pcs|штук)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizePhone(input: string | null | undefined): string | undefined {
    if (!input) return undefined;
    let digits = String(input).replace(/\D/g, '');
    if (digits.length === 9) digits = `998${digits}`;
    // Faqat haqiqiy O'zbekiston raqami (998 + 9 raqam) qabul qilinadi; aks holda
    // undefined -> missingRequired uni belgilaydi -> operator WebApp'ga o'tadi
    // (buzuq raqamni jimgina saqlab qo'ymaslik uchun).
    return /^998\d{9}$/.test(digits) ? `+${digits}` : undefined;
  }

  // Geografik nomni base holatga keltiradi: tumani/shahri/viloyati kabi
  // qo'shimchalarni olib tashlaydi (operator kiritishi bilan DB nomini
  // solishtirish uchun — operator qo'shimcha yozmaydi).
  private normGeo(s: string): string {
    return (s || '')
      .toLowerCase()
      .trim()
      .normalize('NFKC')
      .replace(/[`ʼʻ']/g, "'")
      .replace(
        /\s*(tumani|tuman|shahri|shahar|shaharcha|viloyati|viloyat|respublikasi|sh\.|t\.)\s*/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ─── Keyingi aniqlashtirilishi kerak bo'lgan maydon ───
  firstUnresolved(
    draft: AiOrderDraft,
  ): { type: 'district' | 'item'; itemIndex?: number } | null {
    if (!draft.district_id && draft.district_candidates?.length) {
      return { type: 'district' };
    }
    for (let i = 0; i < draft.items.length; i++) {
      if (!draft.items[i].product_id && draft.items[i].candidates?.length) {
        return { type: 'item', itemIndex: i };
      }
    }
    return null;
  }

  // Umuman hal bo'lmaydigan (nomzod ham yo'q) yetishmovchiliklar — WebApp'ga yo'naltiriladi
  missingRequired(draft: AiOrderDraft): string[] {
    const missing: string[] = [];
    if (!draft.customer_name) missing.push('mijoz ismi');
    if (!draft.phone_number) missing.push('telefon raqami');
    if (!draft.district_id && !draft.district_candidates?.length)
      missing.push('tuman');
    if (!draft.items.length) missing.push('mahsulot');
    else if (
      draft.items.some((i) => !i.product_id && !i.candidates?.length)
    )
      missing.push('katalogda topilmagan mahsulot');
    if (draft.total_price == null) missing.push('narx');
    return missing;
  }

  // ─── Tasdiq kartasi (barcha hal bo'lgach) ───
  buildConfirmCard(draft: AiOrderDraft): {
    text: string;
    keyboard: { inline_keyboard: { text: string; callback_data: string }[][] };
  } {
    const itemsText = draft.items
      .map(
        (it, i) =>
          `   ${i + 1}. ${it.resolved_name || it.name} — ${it.quantity} dona`,
      )
      .join('\n');

    const priceText =
      draft.total_price != null
        ? `${draft.total_price
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`
        : "— (WebApp'da kiriting)";

    // MUHIM: plain text (Markdown YO'Q) — mijoz ismi/mahsulot nomida _ * [ ]
    // kabi belgilar Telegram parse'ini buzib, buyurtmani jimgina yo'qotmasligi
    // uchun. parse_mode ishlatilmaydi.
    const text =
      `🤖 AI buyurtmani shunday tushundi — tekshiring:\n\n` +
      `👤 Mijoz: ${draft.customer_name || '-'}\n` +
      `📞 Telefon: ${draft.phone_number || '-'}\n` +
      `📍 Manzil: ${draft.district_label || '-'}${
        draft.address ? ` (${draft.address})` : ''
      }\n` +
      `📦 Mahsulotlar:\n${itemsText || '-'}\n` +
      `💰 Jami: ${priceText}\n` +
      (draft.comment ? `📝 Izoh: ${draft.comment}\n` : '');

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [
            {
              text: '✅ Tasdiqlash',
              callback_data: `order_ai:confirm:${draft.nonce}`,
            },
            {
              text: '❌ Bekor',
              callback_data: `order_ai:cancel:${draft.nonce}`,
            },
          ],
        ],
      },
    };
  }

  buildDistrictClarify(draft: AiOrderDraft): {
    text: string;
    keyboard: { inline_keyboard: { text: string; callback_data: string }[][] };
  } {
    const cands = draft.district_candidates || [];
    return {
      text: `❓ "${draft.district_name}" tumani aniq topilmadi. Qaysi biri?`,
      keyboard: {
        inline_keyboard: [
          ...cands.map((c, idx) => [
            {
              text: c.label,
              callback_data: `order_ai:pickdistrict:${draft.nonce}:${idx}`,
            },
          ]),
          [{ text: '❌ Bekor', callback_data: `order_ai:cancel:${draft.nonce}` }],
        ],
      },
    };
  }

  buildItemClarify(
    draft: AiOrderDraft,
    itemIndex: number,
  ): {
    text: string;
    keyboard: { inline_keyboard: { text: string; callback_data: string }[][] };
  } {
    const item = draft.items[itemIndex];
    const cands = item.candidates || [];
    return {
      text: `❓ "${item.name}" (${item.quantity} dona) uchun mahsulotni tanlang:`,
      keyboard: {
        inline_keyboard: [
          ...cands.map((c, idx) => [
            {
              text: c.name,
              callback_data: `order_ai:pickproduct:${draft.nonce}:${itemIndex}:${idx}`,
            },
          ]),
          [{ text: '❌ Bekor', callback_data: `order_ai:cancel:${draft.nonce}` }],
        ],
      },
    };
  }

  // ─── Commit: mavjud createOrderByBot ni qayta ishlatish ───
  async commit(
    draft: AiOrderDraft,
    operator: ResolvedOperator,
  ): Promise<{ ok: boolean; message: string }> {
    // Barcha majburiy maydonlar hal bo'lganini yakuniy tekshirish
    if (!draft.customer_name || !draft.phone_number || !draft.district_id) {
      return { ok: false, message: 'Buyurtma to‘liq emas.' };
    }
    // Telefon formati (createOrderByBot to'g'ridan chaqirilgani uchun DTO
    // validatsiyasi ishlamaydi — shu yerda tekshiramiz)
    if (!/^\+998\d{9}$/.test(draft.phone_number)) {
      return { ok: false, message: '📞 Telefon raqami noto‘g‘ri.' };
    }
    const resolvedItems = draft.items.filter((i) => i.product_id);
    if (!resolvedItems.length || resolvedItems.length !== draft.items.length) {
      return { ok: false, message: 'Barcha mahsulotlar tanlanmagan.' };
    }
    if (draft.total_price == null || draft.total_price <= 0) {
      return { ok: false, message: 'Narx kiritilmagan.' };
    }

    const dto: CreateOrderByBotDto = {
      name: draft.customer_name,
      phone_number: draft.phone_number,
      district_id: draft.district_id,
      extra_number: draft.extra_number,
      address: draft.address,
      order_item_info: resolvedItems.map((i) => ({
        product_id: i.product_id as string,
        quantity: i.quantity,
      })),
      total_price: draft.total_price,
      where_deliver: Where_deliver.CENTER,
      comment: draft.comment,
      operator: operator.user.name,
    };

    const res = (await this.orderService.createOrderByBot(dto, operator.jwt)) as {
      statusCode?: number;
      message?: string;
    };

    // 201 = yangi yaratildi, 200 = dublikat (yangi yaratilmadi), aks holda xato.
    // (Xato holatida createOrderByBot odatda throw qiladi — uni chaqiruvchi
    //  handleAiCallback try/catch ushlaydi; bu tarmoq himoya sifatida qoladi.)
    if (res?.statusCode === 201) {
      return { ok: true, message: '✅ Buyurtma yaratildi!' };
    }
    if (res?.statusCode === 200) {
      return {
        ok: true,
        message: 'ℹ️ Bu buyurtma allaqachon yaratilgan (dublikat).',
      };
    }
    return { ok: false, message: `❌ ${res?.message || 'Buyurtma yaratilmadi'}` };
  }
}
