import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ProductEntity } from 'src/core/entity/product.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { OrderService } from 'src/api/order/order.service';
import { ClaudeService } from 'src/infrastructure/ai/claude.service';
import { AiBalanceService } from 'src/api/ai-balance/ai-balance.service';
import { MyLogger } from 'src/logger/logger.service';
import { Roles, Where_deliver } from 'src/common/enums';
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
- region_name = viloyat nomi (masalan "Andijon"), district_name = tuman nomi (masalan "Asaka"). Faqat matndan.
- total_price = butun buyurtma narxi RAQAM sifatida (masalan "250 ming" -> 250000, "2.5 mln" -> 2500000). Aniq bo'lmasa null.
- comment = yetkazish bo'yicha izoh (masalan "kechqurun keling"). Telefon raqamlar comment'ga tushmasin.
- Telefon O'zbekiston formatida; faqat raqamlarni ol.
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
    };
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
    if (!draft.district_name) return;

    const districts = await this.districtRepo.find({ relations: ['region'] });
    const q = this.normGeo(draft.district_name);

    // Base-nom (geografik qo'shimchalarsiz) bo'yicha moslash: operator "tumani"
    // yozmaydi, DB'da esa "... tumani" bo'ladi — shuning uchun ikkala tomon ham
    // qo'shimchasiz solishtiriladi.
    let matches = districts.filter((d) => this.normGeo(d.name) === q);
    if (!matches.length) {
      // Aniq base-mos topilmasa — qism (substring) bo'yicha
      matches = districts.filter((d) => {
        const dn = this.normGeo(d.name);
        return dn.length > 2 && (dn.includes(q) || q.includes(dn));
      });
    }

    // Viloyat berilgan bo'lsa — shu viloyatga cheklab aniqlashtirish
    if (draft.region_name && matches.length > 1) {
      const rq = this.normGeo(draft.region_name);
      const inRegion = matches.filter(
        (d) => d.region && this.normGeo(d.region.name) === rq,
      );
      if (inRegion.length > 0) matches = inRegion;
    }

    const toLabel = (d: DistrictEntity) =>
      d.region?.name ? `${d.region.name}, ${d.name}` : d.name;

    if (matches.length === 1) {
      draft.district_id = matches[0].id;
      draft.district_label = toLabel(matches[0]);
      draft.district_candidates = undefined;
    } else if (matches.length > 1) {
      draft.district_id = undefined;
      draft.district_candidates = matches
        .slice(0, MAX_CANDIDATE_BUTTONS)
        .map((d) => ({ id: d.id, label: toLabel(d) }));
    } else {
      draft.district_id = undefined;
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
