import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity } from 'typeorm';

@Entity('paymentsToMarket')
export class UserSalary extends BaseEntity {
  @Column({ type: 'int' })
  user_id: string;

  @Column({ type: 'int' })
  salary_amount: number;

  @Column({ type: 'varchar' })
  payment_date: string;

  @Column({ type: 'varchar', nullable: true })
  comment?: string;

  @Column({ type: 'uuid' })
  created_by: string;
}
