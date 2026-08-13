import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';

/**
 * Elchin (moliyaviy AI) bilan yozishmalar tarixi — har foydalanuvchi uchun.
 * Bitta qator = bitta savol-javob almashinuvi (question + answer). Muhim
 * moliyaviy ma'lumotlar yo'qolmasligi uchun DB'да saqlanadi (har qurilmada ko'rinadi).
 */
@Entity('ai_finance_chat')
@Index('IDX_AFC_USER_CREATED', ['user_id', 'created_at'])
export class AiFinanceChatEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'jsonb', nullable: true })
  tools: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  file_name: string | null;
}
