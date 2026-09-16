import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './users.entity';
import { bigintTransformer as bigintTransformerNullable } from 'src/common/database/bigint.transformer';

/**
 * ISBOT FAYLI (foto).
 *
 * NEGA SO'ROVDAN ALOHIDA JADVAL. Fayl so'rovdan OLDIN yuklanadi: kuryer
 * modalda foto tanlaydi → fayl darhol ketadi → qaytgan `id` sotuv/bekor
 * so'roviga JSON maydon sifatida qo'shiladi. Bu ataylab shunday:
 *
 *   1. Sotuv endpointini multipart'ga aylantirish kerak emas — jonli pul
 *      yo'lining portlash radiusi nolga tushadi.
 *   2. Fayl yuklanmay qolsa sotuv YIQILMAYDI (kuryer "isbotsiz davom etish"
 *      tugmasini bosadi, so'rov `AWAITING_PROOF` bo'lib 24 soat kutadi).
 *
 * Buning narxi — yuklanib, lekin hech qaysi so'rovga bog'lanmagan ORFAN
 * fayllar. Ularni CRON 24 soatdan keyin diskdan ham, DB'dan ham o'chiradi.
 *
 * ⚠️ `stored_name` va `rel_path` HECH QACHON API javobiga chiqmaydi. Fayl
 * faqat egalik tekshiradigan endpoint orqali beriladi — `/uploads` static
 * papkasi autentifikatsiyasiz va helmet'dan OLDIN ro'yxatdan o'tgan.
 */
@Entity('extra_cost_proof')
@Index('IDX_ECP_COURIER_HASH', ['courier_id', 'sha256'])
export class ExtraCostProofEntity extends BaseEntity {
  /** Egalik — kuryer faqat O'ZI yuklagan faylni so'rovga bog'lay oladi. */
  @Column({ type: 'uuid' })
  courier_id: string;

  /** Diskdagi nom: `randomUUID() + oq-ro'yxatdan-olingan-kengaytma`. */
  @Column({ type: 'varchar' })
  stored_name: string;

  /** `PROOF_DIR` ga NISBATAN yo'l: `YYYY/MM/<stored_name>`. */
  @Column({ type: 'varchar' })
  rel_path: string;

  /**
   * SERVERDA aniqlangan MIME (magic-byte bo'yicha). Klient yuborgan
   * `Content-Type` ga ishonilmaydi — `.jpg` deb nomlangan HTML fayl saqlangan
   * XSS vektori bo'lardi.
   */
  @Column({ type: 'varchar' })
  mime: string;

  @Column({ type: 'int' })
  size_bytes: number;

  /** Dublikat isbotni aniqlash uchun. */
  @Column({ type: 'char', length: 64 })
  sha256: string;

  /** `NULL` = hali hech qaysi so'rovga bog'lanmagan (orfan nomzodi). */
  @Column({ type: 'uuid', nullable: true })
  request_id: string | null;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  bound_at: number | null;

  /**
   * VIDEO SIQISH HOLATI (`NULL` — rasm, ya'ni tegishli emas).
   *
   *   `pending` — navbatda yoki ishlanmoqda
   *   `done`    — siqildi, `stored_name`/`mime`/`size_bytes` YANGILANDI
   *   `skipped` — siqish kerak emas yoki mumkin emas (ffmpeg yo'q, natija
   *               asl fayldan kichik bo'lmadi)
   *   `failed`  — ffmpeg xato berdi. ASL FAYL joyida qoladi.
   *
   * ⚠️ `failed` va `skipped` ham ISHLAYDIGAN holat: isbot baribir ko'riladi,
   * faqat diskda ko'proq joy egallaydi. Siqish — optimallashtirish, dalilning
   * o'zi emas.
   */
  @Column({ type: 'varchar', length: 16, nullable: true })
  transcode_status: string | null;

  /**
   * Siqishdan OLDINGI hajm (`NULL` — siqilmagan).
   *
   * Audit uchun: "80 MB qabul qilindi → 3 MB saqlandi". Busiz siqish
   * haqiqatan ishlayaptimi yoki jimgina `skipped` bo'lyaptimi — bilib
   * bo'lmasdi.
   */
  @Column({ type: 'int', nullable: true })
  original_size_bytes: number | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courier_id' })
  courier: UserEntity;
}
