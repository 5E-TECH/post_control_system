import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';
import { bigintTransformerNonNull } from 'src/common/database/bigint.transformer';

/**
 * Elchi'dan OLINGAN to'lov — qo'lda kiritiladi (M6).
 *
 * NEGA QO'LDA. Elchi bizga pulni o'z kassasidan chiqaradi
 * (`POST /cashbox/payment/market`) — bu amal Elchi operatori tomonidan
 * bajariladi va **PCS bu haqda hech qanday signal olmaydi**. Ya'ni
 * "Elchi bizga qarz" summasi hech qachon o'z-o'zidan kamaymaydi.
 *
 * Shu bois panelda qo'lda kiritish maydoni bor: operator pul kelganini
 * shu yerda qayd etadi va qarz shunga qarab kamayadi.
 *
 * ⚠️ BU KASSA EMAS. Yozuv `cashbox_history`ga tegmaydi va balansni
 * o'zgartirmaydi — u faqat **solishtirish daftari**: "Elchi qancha yig'di"
 * va "Elchi qancha to'ladi" farqini ko'rsatadi. Kassa harakati (agar kerak
 * bo'lsa) alohida, odatdagi kassa oqimi orqali kiritiladi. Aks holda bitta
 * pul ikki marta hisoblanardi.
 */
@Entity('elchi_settlement_payment')
export class ElchiSettlementPaymentEntity extends BaseEntity {
  /** Olingan summa (so'm). Musbat bo'lishi shart. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  /**
   * To'lov SANASI (epoch ms) — kiritilgan sana emas.
   *
   * Ajratilgani muhim: operator kechagi to'lovni bugun kiritishi mumkin, va
   * davr bo'yicha hisob-kitob haqiqiy to'lov sanasiga tayanishi kerak.
   */
  @Index('IDX_ELCHI_SETTLEMENT_PAID_AT')
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  paid_at: number;

  /** Izoh — o'tkazma raqami, kim topshirdi va h.k. */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Kim kiritdi (audit uchun; foydalanuvchi o'chirilsa yozuv qoladi). */
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;
}
