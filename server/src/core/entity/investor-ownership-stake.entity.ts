import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './users.entity';
import {
  bigintTransformer,
  bigintTransformerNonNull,
} from 'src/common/database/bigint.transformer';

// Versiyalangan egalik ulushi (basis points: 1% = 100 bp, 100% = 10000 bp).
// Ulush o'zgarganda joriy ochiq qator yopiladi (effective_to o'rnatiladi) va
// yangi ochiq qator qo'shiladi — tarix HECH QACHON o'zgartirilmaydi.
// Har investorda faqat BITTA ochiq (effective_to = NULL) qator bo'ladi
// (migration'dagi partial unique UQ_IOS_OPEN_STAKE bilan kafolatlanadi).
@Entity('investor_ownership_stake')
@Index('IDX_IOS_INVESTOR', ['investor_id'])
@Index('IDX_IOS_INVESTOR_FROM', ['investor_id', 'effective_from'])
export class InvestorOwnershipStakeEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  investor_id: string;

  // 0..10000 (DB CHECK migration'da).
  @Column({ type: 'int' })
  ownership_bps: number;

  // Amal qilish boshi (epoch-ms, inklyuziv).
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  effective_from: number;

  // Amal qilish oxiri (epoch-ms, eksklyuziv). NULL = hozir ochiq/faol.
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  effective_to: number | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'investor_id' })
  investor?: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: UserEntity;
}
