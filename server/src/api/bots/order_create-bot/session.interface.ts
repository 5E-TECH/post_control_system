import { Context } from 'telegraf';
import type { OrderPreview } from './ai-order.service';

export type BotStep =
  | 'initial'
  | 'waiting_for_token'
  | 'waiting_for_phone'
  | 'ready'
  | 'collecting' // yetishmayotgan maydonlar so'ralmoqda (matn to'planmoqda)
  | 'clarifying' // past-ishonchli maydon so'ralmoqda (tuman/mahsulot)
  | 'confirming' // tasdiq kartasi ko'rsatilgan, tugma kutilmoqda
  | 'fixing'; // ko'p-buyurtma kartasi bot ichida to'g'rilanmoqda (maydon-ma-maydon)

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
  full_address?: string; // manzilning to'liq matni (rezolyutsiya zaxirasi)
  items: AiDraftItem[];
  total_price?: number;
  comment?: string;
  operator?: string; // mutaxassis / sotuvchi ismi
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

  // ─── Ko'p-buyurtma oqimi (platformadagidek) ───
  // Bitta matndan bir nechta buyurtma tahlil qilinadi; har biri karta bo'lib
  // chiqadi. Tayyorlari "Yaratish", kamchiliklilari "Tuzatish" tugmasi bilan.
  order_previews?: OrderPreview[]; // oxirgi tahlildagi buyurtmalar (indeks bo'yicha)
  previews_nonce?: string; // partiya belgisi (eski kartalardan yaratilmasin)
  summary_msg_id?: number; // yuqoridagi jonli xulosa (tayyor/kamchilik/balans) — yangilanib turadi

  // Bot ichida bitta kartani to'g'rilash holati (maydon-ma-maydon sehrgar).
  fixing?: {
    nonce: string; // previews_nonce bilan mos bo'lishi shart (eskirgan bo'lmasin)
    idx: number; // order_previews ichidagi qaysi buyurtma
    field?: 'name' | 'phone' | 'price' | 'district' | 'item'; // kutilayotgan matn nima uchun
    item_idx?: number; // field==='item' bo'lganda qaysi mahsulot (-1 = yangi qo'shish)
    prompt_msg_id?: number; // joriy tuzatish so'rovi xabari (yangisi kelganda o'chiriladi — chat tozaligi)
    card_msg_id?: number; // asl karta xabari (tuzatish tugagach shu joyda yangilanadi)
    error_note?: string; // oxirgi noto'g'ri kiritish izohi (keyingi prompt oldiga qo'shiladi — alohida xabar emas)
    region_list?: { id: string; name: string }[]; // viloyat tanlash tugmalari uchun (fixregion callback indeks bo'yicha)
  };
}

export interface MyContext extends Context {
  session: MySession;
}
