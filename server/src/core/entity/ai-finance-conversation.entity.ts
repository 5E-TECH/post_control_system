import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';

/**
 * Elchin (moliyaviy AI) bilan ALOHIDA suhbat (sessiya) — har foydalanuvchi.
 * Har suhbat o'z yozishmalari (ai_finance_chat.conversation_id) bilan bog'liq.
 * title birinchi savoldan olinadi; updated_at oxirgi xabarда yangilanadi.
 */
@Entity('ai_finance_conversation')
@Index('IDX_AFCONV_USER_UPDATED', ['user_id', 'updated_at'])
export class AiFinanceConversationEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  title: string;
}
