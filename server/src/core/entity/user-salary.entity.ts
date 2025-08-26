import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, OneToOne } from 'typeorm';
import { UserEntity } from './users.entity';
import { Max, Min } from 'class-validator';

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
  @Min(1)
  @Max(30)
  payment_day: number;

  @OneToOne(() => UserEntity, (user) => user.salary)
  user: UserEntity;
}
