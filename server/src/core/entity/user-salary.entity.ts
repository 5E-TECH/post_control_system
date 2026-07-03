import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, OneToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from './users.entity';
import { Max, Min } from 'class-validator';
import { bigintTransformerNonNull as bigintTransformer } from 'src/common/database/bigint.transformer';

@Entity('user_salary')
@Index('IDX_USER_SALARY_USER_ID', ['user_id'])
@Index('IDX_USER_SALARY_PAYMENT_DAY', ['payment_day'])
export class UserSalaryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  salary_amount: number;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  have_to_pay: number;

  // faqat 1 dan 30 gacha son qabul qiladi
  @Column({ type: 'int' })
  @Min(1)
  @Max(30)
  payment_day: number;

  /**
   * Oxirgi marta oylik hisoblangan davr — 'YYYY-MM' (masalan '2026-06').
   *
   * Idempotentlik MANBAI. Ilgari CRON `updated_at` sanasiga tayanardi, lekin
   * `updated_at` HAR `save()`da (avans/maosh to'lash, summa tahriri) yangilanadi —
   * shu sabab o'sha kuni tegilgan ishchilar noto'g'ri "allaqachon qo'shilgan" deb
   * o'tkazib yuborilardi. Bu ustun FAQAT accrual (CRON/catch-up) tomonidan
   * o'zgartiriladi va boshqa hech qaysi oqim unga tegmaydi.
   */
  @Column({ type: 'varchar', length: 7, nullable: true })
  last_accrued_period: string | null;

  // Bu tomonda FK bor → JoinColumn shu yerda
  @OneToOne(() => UserEntity, (user) => user.salary)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
