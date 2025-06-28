import { BaseEntity } from "src/common/database/BaseEntity";
import { Operation_type, Source_type } from "src/common/enums";
import { Column } from "typeorm";

export class CashboxHistoryEntity extends BaseEntity {
    @Column ({ type: 'enum', enum: Operation_type })
    operation_type: Operation_type;

    @Column ({ type: 'enum', enum: Source_type })
    source_type: Source_type;

    @Column ({ type: 'varchar' })
    source_id: string | null;

    @Column ({ type: 'number' })
    amount: number;

    @Column ({ type: 'number' })
    balance_after: number;

    @Column ({ type: 'varchar' })
    comment: string;

    @Column ({ type: 'varchar' })
    created_by: string
}