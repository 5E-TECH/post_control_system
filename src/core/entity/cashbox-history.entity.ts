import { BaseEntity } from "src/common/database/BaseEntity";
import { Cashbox_type, Operation_type, Source_type } from "src/common/enums";
import { Column, Entity } from "typeorm";

@Entity("cashbox-history")
export class CashboxHistoryEntity extends BaseEntity {
    @Column ({ type: 'enum', enum: Operation_type })
    operation_type: Operation_type;

    @Column ({ type: 'uuid' })
    cashbox_id: string;

    @Column ({ type: 'enum', enum: Source_type })
    source_type: Source_type;

    @Column ({ type: 'uuid', nullable: true })
    source_id: string | null;

    @Column ({ type: 'int' })
    amount: number;

    @Column ({ type: 'int' })
    balance_after: number;

    @Column ({ type: 'varchar', nullable: true })
    comment: string;

    @Column ({ type: 'varchar' })
    created_by: string
}