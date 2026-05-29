import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { UserEntity } from './users.entity';
import { RegionEntity } from './region.entity';

/**
 * Super kuryerga biriktirilgan viloyatlar va (ixtiyoriy) per-region tariflar.
 *
 * Oddiy kuryer bitta `users.region_id` ga ega. Super kuryer
 * (`users.is_super_courier = true`) bir nechta viloyatga xizmat qiladi —
 * har biri shu jadvalda alohida qator.
 *
 * `tariff_home` / `tariff_center` NULL bo'lsa — super kuryerning umumiy
 * `users.tariff_home` / `users.tariff_center` (flat) qiymatlariga fallback
 * qilinadi. Kelajakda region/tuman bo'yicha turli tariflar shu yerga yoziladi.
 */
@Entity('courier_regions')
@Unique('UQ_COURIER_REGION', ['courier_id', 'region_id'])
@Index('IDX_COURIER_REGION_REGION', ['region_id'])
@Index('IDX_COURIER_REGION_COURIER', ['courier_id'])
export class CourierRegionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  courier_id: string;

  @Column({ type: 'uuid' })
  region_id: string;

  // Per-region tarif (null = super kuryerning umumiy flat tarifiga fallback)
  @Column({ type: 'int', nullable: true })
  tariff_home: number | null;

  @Column({ type: 'int', nullable: true })
  tariff_center: number | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courier_id' })
  courier: UserEntity;

  @ManyToOne(() => RegionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'region_id' })
  region: RegionEntity;
}
