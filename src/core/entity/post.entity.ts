import { BaseEntity } from "src/common/database/BaseEntity";
import { Column, Entity } from "typeorm";

@Entity('post')
export class PostEntity extends BaseEntity {
    @Column({ type: 'varchar', name: 'courier_id' })
    courier_id: string;

    @Column({ type: 'decimal', name: 'post_total_price' })
    post_total_price: number;

    @Column({ type: 'smallint', name: 'order_quantity' })
    order_quantity: number;

    @Column({ type: 'varchar', name: 'QR_code_name' })
    QR_code_name: string;
}