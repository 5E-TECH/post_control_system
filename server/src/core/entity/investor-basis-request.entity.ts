import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './users.entity';

// Admin tomonidan TAKLIF qilingan foyda-asosi (net/gross) o'zgarishi.
// Investor tasdiqlagunicha kutib turadi. Har investorda faqat BITTA kutayotgan
// so'rov (investor_id unique).
@Entity('investor_basis_request')
@Index('UQ_IBR_INVESTOR', ['investor_id'], { unique: true })
export class InvestorBasisRequestEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  investor_id: string;

  // Taklif qilingan asos: 'net' | 'gross'.
  @Column({ type: 'varchar' })
  requested_basis: string;

  // Kim taklif qildi (admin/superadmin).
  @Column({ type: 'uuid', nullable: true })
  requested_by: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'investor_id' })
  investor?: UserEntity;
}
