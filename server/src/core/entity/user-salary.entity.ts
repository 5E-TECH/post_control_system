import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity } from 'typeorm';

@Entity('userSalary')
export class UserSalaryEntity extends BaseEntity {
  @Column({ type: 'int' })
  user_id: string;

  @Column({ type: 'int' })
  salary_amount: number;

  @Column({ type: 'int' })
  have_to_pay: number;

  // Bu faqat 1 dan 30 gacha son qabul qiladi
  @Column({ type: 'int' })
  payment_day: number;
}
