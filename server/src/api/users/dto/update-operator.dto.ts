import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from 'src/common/enums';

/**
 * MARKET O'Z OPERATORINI TAHRIRLAYDI.
 *
 * ⚠️ TELEFON VA PAROL ATAYLAB YO'Q.
 *   · telefon — bu login identifikatori va bot bog'lanish kaliti; uni
 *     boshqa odam o'zgartirsa operator o'z hisobidan chiqib qoladi;
 *   · parol — uni faqat egasi biladi va o'zi almashtiradi
 *     (`PATCH /user/self`).
 * Marketga kerak bo'lgani: ismni to'g'rilash va vaqtincha to'xtatish.
 */
export class UpdateOperatorDto {
  @ApiPropertyOptional({
    description: 'Operator ismi',
    example: 'Aliyev Vali',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Ism juda qisqa" })
  @MaxLength(120, { message: 'Ism juda uzun' })
  name?: string;

  @ApiPropertyOptional({
    description:
      "Holati. `inactive` — operator tizimga kira olmaydi va yangi " +
      "buyurtmaga biriktirilmaydi. Mavjud buyurtmalari va daromadi " +
      "TEGILMAYDI — bu o'chirish emas, vaqtincha to'xtatish.",
    enum: Status,
    example: Status.INACTIVE,
  })
  @IsOptional()
  @IsEnum(Status, { message: "Holat faqat 'active' yoki 'inactive'" })
  status?: Status;
}
