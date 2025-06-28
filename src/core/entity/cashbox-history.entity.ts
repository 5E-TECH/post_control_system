import { BaseEntity } from "src/common/database/BaseEntity";
import { Operation_type } from "src/common/enums";
import { Column } from "typeorm";

export class CashboxHistoryEntity extends BaseEntity {
    @Column ({ type: 'enum', enum: Operation_type })
    operation_type: String;


}