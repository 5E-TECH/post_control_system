import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';
import { bigintTransformerNonNull } from 'src/common/database/bigint.transformer';

/**
 * AI (Claude) chaqiruvlarining REAL xarajati — har Anthropic so'rovi uchun
 * token sarfi va hisoblangan narx (USD + so'm). AI dashboard shu jadvaldan
 * "har buyurtmaga o'rtacha necha so'm" va "Elchin har promptga qancha
 * sarflaydi"ni chiqaradi.
 *
 * Bir qator = bitta foydalanuvchi-ko'rinadigan AI amali:
 *  - order-AI ekstraksiya/tuman/mahsulot moslash (har biri alohida qator)
 *  - Elchin bitta chat savoli (askWithTools — ko'p qadam bitta qatorga yig'iladi)
 *
 * cost_uzs = cost_usd * usd_uzs_rate (kurs qatorda saqlanadi — audit; kurs
 * keyin o'zgarsa eski xarajat o'zgarmaydi). Yozuv fire-and-forget: AI amalini
 * hech qachon buzmaydi (xato bo'lsa jimgina o'tkazib yuboriladi).
 */
@Entity('ai_usage_log')
// Kunlik/oraliq agregatsiya (dashboard) — sana bo'yicha tez.
@Index('IDX_AIUSAGE_CREATED', ['created_at'])
@Index('IDX_AIUSAGE_FEATURE_CREATED', ['feature', 'created_at'])
@Index('IDX_AIUSAGE_AREA_CREATED', ['request_area', 'created_at'])
// Buyurtma detali: shu buyurtmaga qancha sarflandi.
@Index('IDX_AIUSAGE_ORDER', ['order_id'])
export class AiUsageLogEntity extends BaseEntity {
  // Aniq AI amali: 'order_extract' | 'order_district' | 'order_item_match' |
  // 'finance_chat' | 'finance_report' | 'finance_category' | 'finance_title' ...
  @Column({ type: 'varchar', length: 40 })
  feature: string;

  // Koarse guruh (dashboard filtri): 'order' | 'finance' | 'bot' | 'other'.
  @Column({ type: 'varchar', length: 16, default: 'other' })
  request_area: string;

  // Ishlatilgan model (masalan 'claude-opus-4-8' / 'claude-haiku-4-5').
  @Column({ type: 'varchar', length: 48 })
  model: string;

  // Anthropic usage — keshdan O'QILMAGAN kirish tokenlari (to'liq narx).
  @Column({ type: 'int', default: 0 })
  input_tokens: number;

  @Column({ type: 'int', default: 0 })
  output_tokens: number;

  // Prompt-caching (hozir ishlatilmaydi -> 0). Kelajakda narx aniq bo'lsin uchun.
  @Column({ type: 'int', default: 0 })
  cache_creation_tokens: number;

  @Column({ type: 'int', default: 0 })
  cache_read_tokens: number;

  // Nechta Anthropic API chaqiruvi shu qatorga yig'ilgan (askWithTools qadamlari).
  @Column({ type: 'int', default: 1 })
  steps: number;

  // Hisoblangan real xarajat. USD kichik son -> aniqlik uchun 6 kasr (numeric).
  @Column({ type: 'numeric', precision: 12, scale: 6, default: 0 })
  cost_usd: number;

  // So'mdagi xarajat (butun so'm). bigint — katta yig'indilar xavfsiz.
  @Column({
    type: 'bigint',
    default: 0,
    transformer: bigintTransformerNonNull,
  })
  cost_uzs: number;

  // Shu qator hisoblangan USD->so'm kursi (audit — kurs keyin o'zgarsa ham
  // eski xarajat qayta hisoblanmaydi).
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  usd_uzs_rate: number;

  // Bog'liq buyurtma (order-AI) — buyurtma detali xarajatini ko'rsatish uchun.
  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  // AI amalini boshlagan foydalanuvchi (admin/ro'yxatchi/market).
  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  // Elchin suhbati (ai_finance_conversation) — chat xarajatini guruhlash uchun.
  @Column({ type: 'uuid', nullable: true })
  conversation_id: string | null;
}
