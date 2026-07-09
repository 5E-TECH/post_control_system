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
  region_name?: string; // matndan (xom)
  district_name?: string; // matndan (xom)
  district_id?: string; // resolver to'ldiradi (UUID)
  district_label?: string; // "Viloyat, Tuman/Shahar" (bot kartasi uchun)
  district_resolved_name?: string; // DB'dagi tuman/shahar nomi (masalan "Navoiy shahri")
  region_id?: string; // DB region UUID (district'dan olinadi)
  region_label?: string; // DB region nomi (masalan "Navoiy viloyati")
  district_candidates?: {
    id: string;
    label: string; // "Viloyat, Tuman/Shahar"
    region_name?: string;
    district_name?: string;
  }[];
  address?: string;
  items: AiDraftItem[];
  total_price?: number;
  comment?: string;
  where_deliver?: 'center' | 'address'; // yetkazish turi
  is_replacement?: boolean; // matn almashtirishni bildiradimi
  replaced_order_id?: string; // avto-tanlangan eski buyurtma (resolver to'ldiradi)
  replacement_candidates?: {
    id: string;
    order_number: number;
    created_at: number;
    total_price: number;
    items: string; // "Mahsulot x2, ..."
  }[];
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
  ai_balance_display?: number; // joriy buyurtmadan keyingi balans (ko'rsatish uchun; undefined = ozod/ko'rsatilmaydi)
}

export interface MyContext extends Context {
  session: MySession;
}
