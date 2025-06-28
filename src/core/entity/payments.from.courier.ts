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

    @Column({ type: 'timestamp' })
    payment_date: Date;

    @Column({ nullable: true })
    comment?: string;

    @Column({ nullable: true })
    seller_id?: string | null;

}