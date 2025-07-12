import { BaseEntity } from "src/common/database/BaseEntity";
import { Column, Entity } from "typeorm";

@Entity('paymentsToMarket')
export class PaymentsToMarketEntity extends BaseEntity {
    @Column({ type: 'int' })
    market_id: string;

    @Column({ type: 'int' })
    amount: number;

    @Column({ type: 'varchar' })
    payment_date: string;

    @Column({type: 'varchar', nullable: true})
    comment?: string;

    @Column ({ type: 'uuid' })
    created_by: string
}