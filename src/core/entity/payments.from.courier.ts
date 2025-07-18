import { BaseEntity } from "src/common/database/BaseEntity";
import { PaymentMethod } from "src/common/enums";
import { Column, Entity } from "typeorm";

@Entity('paymentsFromCourier')
export class PaymentsFromCourierEntity extends BaseEntity {
    @Column('uuid')
    courier_id: string;

    @Column('numeric')
    amount: number;

    @Column({ type: 'enum', enum: PaymentMethod })
    payment_method: PaymentMethod;

    @Column({ type: 'varchar' })
    payment_date: string;

    @Column({ type: 'varchar', nullable: true })
    comment?: string;

    @Column({ type: 'varchar', nullable: true })
    market_id?: string | null;

}