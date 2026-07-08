import { Context } from 'telegraf';

export type BotStep =
  | 'initial'
  | 'waiting_for_token'
  | 'waiting_for_phone'
  | 'ready'
  | 'collecting' // yetishmayotgan maydonlar so'ralmoqda (matn to'planmoqda)
  | 'clarifying' // past-ishonchli maydon so'ralmoqda (tuman/mahsulot)
  | 'confirming'; // tasdiq kartasi ko'rsatilgan, tugma kutilmoqda

export interface MarketSessionData {
  id: string;
  name: string;
  add_order?: boolean;
  role?: string;
}

// ─── AI buyurtma qoralamasi (draft) ───
// Claude faqat NOMLARNI chiqaradi; UUID'larni resolver (DB moslash) to'ldiradi.
export interface AiDraftItem {
  name: string; // Claude chiqargan mahsulot nomi
  quantity: number;
  product_id?: string; // resolver to'ldiradi (UUID)
  resolved_name?: string; // katalogdagi haqiqiy nom
  candidates?: { id: string; name: string }[]; // noaniqda tanlov uchun
}

export interface AiOrderDraft {
  nonce: string; // har bir draftga unikal; eskirgan karta tugmalarini rad etadi
  customer_name?: string;
  phone_number?: string; // +998 formatga normallashtirilgan
  extra_number?: string;
  region_name?: string;
  district_name?: string;
  district_id?: string; // resolver to'ldiradi (UUID)
  district_label?: string; // "Viloyat, Tuman"
  district_candidates?: { id: string; label: string }[];
  address?: string;
  items: AiDraftItem[];
  total_price?: number;
  comment?: string;
}

export interface MySession {
  step: BotStep;
  waitingForPhone: boolean;
  marketData?: MarketSessionData;
  phoneNumber?: string;
  userId?: number;
  chatId?: number;
  name?: string;
  lastTokenAttemptAt?: number;
  tokenAttemptsInWindow?: number;

  // ─── AI oqimi holati ───
  order_draft?: AiOrderDraft;
  draft_raw?: string; // joriy buyurtmaning to'planayotgan xom matni
  draft_attempts?: number; // ketma-ket to'liqsiz/xato urinishlar soni
}

export interface MyContext extends Context {
  session: MySession;
}
