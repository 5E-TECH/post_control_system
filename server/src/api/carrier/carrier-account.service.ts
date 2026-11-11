import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import config from 'src/config';
import { parseDurationToMs } from 'src/common/utils/parse-duration.util';
import { ActivityLogEntity } from 'src/core/entity/activity-log.entity';
import { CarrierAccountEntity } from 'src/core/entity/carrier-account.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { Cashbox_type, Roles, Status } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CARRIER_KEY_PREFIX } from './carrier-error-codes';
import {
  IP_ALLOWLIST_MAX_ENTRIES,
  normalizeIpAllowlistRules,
} from './utils/ip-allowlist';

/**
 * Carrier kuryerining `users.external_provider` qiymati (qaror D1).
 *
 * ⚠️ `'ldg'` / `'elchi'` HECH QACHON ishlatilmaydi: o'sha qiymatlar
 * `assertCourierOwnsOrder` da egalik tekshiruvini O'TKAZIB YUBORADI
 * (order.service.ts), ya'ni carrier istalgan buyurtmaga amal qila olardi.
 * `'carrier'` esa dispatch shoxlarida (`=== 'ldg'` / `=== ELCHI_PROVIDER`)
 * inert, lekin shtraf istisnosi va tashqi qo'shimcha xarajat siyosatini
 * (`external_provider` truthy) yoqadi — bu kelishilgan (Q2).
 */
export const CARRIER_EXTERNAL_PROVIDER = 'carrier';

/**
 * Carrier kuryeri JWT sessiyasini OLMAYDI (login, refresh, o'z profilini
 * o'zgartirish) — `UserService` javobi. Tashqi kompaniya faqat API kaliti
 * bilan ishlaydi; kuryer sessiyasi kalit, IP ro'yxati, akkaunt o'chirgichi
 * va adapter pul qoidalarini chetlab o'tardi.
 */
export const CARRIER_COURIER_LOGIN_MESSAGE =
  "Bu kuryer tashqi yetkazuvchiga (Carrier API) bog'langan — akkauntga kirib bo'lmaydi, amallar faqat API kaliti orqali";

/**
 * Bog'lashgacha ochilgan JWT sessiya hali tirik bo'lishi mumkin bo'lgan
 * oyna (ms). Refresh cookie bog'lash paytida tirik bo'lsa (login'dan
 * `REFRESH_TOKEN_TIME` ichida), undan hozirgina olingan access token yana
 * `ACCESS_TOKEN_TIME` yashaydi. Bog'langan kuryerga refresh endi rad
 * etiladi, lekin allaqachon berilgan access token stateless (`JwtGuard`
 * bazaga qaramaydi) — uni faqat bog'lashni rad etib to'xtatish mumkin.
 * Sozlamani o'qib bo'lmasa — `null`: oyna cheksiz (har qanday login rad).
 */
export function carrierBindLoginLookbackMs(): number | null {
  try {
    return (
      parseDurationToMs(config.ACCESS_TOKEN_TIME) +
      parseDurationToMs(config.REFRESH_TOKEN_TIME)
    );
  } catch {
    return null;
  }
}

/** `touchLastUsed` — bitta akkaunt uchun bazaga eng ko'pi shuncha vaqtda bir marta. */
const LAST_USED_TOUCH_INTERVAL_MS = 60_000;
const LAST_USED_CACHE_MAX = 10_000;
const NAME_MAX_LENGTH = 200;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `sha256(key)` hex — bazada faqat shu saqlanadi. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Yangi kalit: `bpc_` + 32 tasodifiy bayt (64 hex) — Elchi'ning
 * `elc_` + `randomBytes(32).hex` generatori bilan bir xil uzunlik va alifbo,
 * faqat prefiks boshqa (qaror D3): operator va log'da qaysi tizim kaliti
 * ekani darhol ko'rinsin.
 */
export function generateCarrierApiKey(): string {
  return `${CARRIER_KEY_PREFIX}${randomBytes(32).toString('hex')}`;
}

/** Admin panel uchun niqoblangan kalit: `bpc_…a1b2`. */
export function maskCarrierApiKey(last4: string | null | undefined): string {
  return `${CARRIER_KEY_PREFIX}…${last4 ?? ''}`;
}

/**
 * Bog'langan kuryer HOZIR ishlay oladimi. To'rt shartning har biri kerak:
 *   - role = courier, status = active, o'chirilmagan — oddiy kuryer qoidasi;
 *   - `external_provider = 'carrier'` — kimdir uni keyin Elchi/LDG vakili
 *     qilib qo'ysa (`bindCourier` eski qiymatni tekshirmasdan yozadi), kalit
 *     egalik tekshiruvi o'chgan kuryer nomidan ishlab qolmasin.
 */
export function isActiveCarrierCourier(
  user:
    | Pick<UserEntity, 'role' | 'status' | 'is_deleted' | 'external_provider'>
    | null
    | undefined,
): boolean {
  return (
    !!user &&
    user.role === Roles.COURIER &&
    user.status === Status.ACTIVE &&
    !user.is_deleted &&
    user.external_provider === CARRIER_EXTERNAL_PROVIDER
  );
}

/** Guard'ga qaytadigan natija — qaror guard'da (401/403/IP). */
export interface CarrierKeyValidation {
  account: CarrierAccountEntity;
  courierActive: boolean;
}

/** Admin javobidagi XAVFSIZ ko'rinish: kalit ham, uning xeshi ham chiqmaydi. */
export interface CarrierAccountView {
  id: string;
  name: string;
  courier_user_id: string;
  courier: {
    id: string;
    name: string;
    phone_number: string;
    status: string;
  } | null;
  api_key_masked: string;
  ip_allowlist: string[] | null;
  is_active: boolean;
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CreateCarrierAccountInput {
  name: string;
  courier_id: string;
  ip_allowlist?: string[] | null;
}

export interface UpdateCarrierAccountInput {
  name?: string;
  ip_allowlist?: string[] | null;
}

/**
 * CARRIER AKKAUNTLARI — tashqi yetkazuvchi kompaniya = BITTA kuryer user.
 *
 * Elchi `apps/integration-service/src/carrier/carrier-account.service.ts`
 * dan ko'chirilgan, BeePost farqlari bilan:
 *   - bitta baza: kuryer holati `validateKey` ning O'ZIDA (join) tekshiriladi,
 *     kesh yo'q — bloklash darhol kuchga kiradi (Elchi'da ≤30 s);
 *   - bog'lashda kuryer "TOZA" bo'lishi shart (pochtasiz, kassasi 0,
 *     boshqa provayderga bog'lanmagan, yaqinda hech kim kirmagan) va uning
 *     paroli hech kim bilmaydigan tasodifiy xeshga almashtiriladi — kuryer
 *     akkaunti orqali tizimga kirib, kalitsiz amal qilib bo'lmasin
 *     (`UserService` login/refresh/profil ham carrier kuryerini rad etadi);
 *   - o'chirish yumshoq va kuryerni `external_provider` dan bo'shatadi.
 *
 * ⚠️ Kalit va uning xeshi HECH QACHON log/javobga chiqmaydi (faqat yaratish
 * va rotatsiya javobida ochiq kalit BIR MARTA).
 */
@Injectable()
export class CarrierAccountService {
  private readonly logger = new Logger(CarrierAccountService.name);
  /** account id → oxirgi `last_used_at` yozilgan payt (xotirada). */
  private readonly lastTouched = new Map<string, number>();

  constructor(
    @InjectRepository(CarrierAccountEntity)
    private readonly accountRepo: Repository<CarrierAccountEntity>,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
    private readonly bcrypt: BcryptEncryption,
  ) {}

  // ===================== HAR SO'ROV (guard) =====================

  /**
   * `X-Api-Key` ni tekshiradi — BITTA so'rov: akkaunt (xesh bo'yicha,
   * o'chirilmagan) + bog'langan kuryer (LEFT JOIN).
   *
   * `is_active` bu yerda FILTRLANMAYDI: guard 401 (kalit yo'q) va 403
   * (akkaunt o'chirilgan) ni ajratishi kerak.
   *
   * ⚠️ Baza xatosi YUTILMAYDI — guard uni 503 `CARRIER_KEY_CHECK_UNAVAILABLE`
   * qiladi. `null` qaytarish "kalit yaroqsiz" (401, qayta urinmang) degani
   * bo'lardi va vaqtinchalik uzilishda kompaniya statuslarni yo'qotardi.
   */
  async validateKey(rawKey: string): Promise<CarrierKeyValidation | null> {
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!key) return null;

    const account = await this.accountRepo
      .createQueryBuilder('account')
      .leftJoin('account.courier', 'courier')
      .addSelect([
        'courier.id',
        'courier.role',
        'courier.status',
        'courier.is_deleted',
        'courier.external_provider',
      ])
      .where('account.api_key_hash = :hash', { hash: hashApiKey(key) })
      .andWhere('account.is_deleted = false')
      .getOne();
    if (!account) return null;

    return { account, courierActive: isActiveCarrierCourier(account.courier) };
  }

  /**
   * `last_used_at` ni yangilaydi — "kompaniya hali ulanyaptimi" savoli uchun.
   *
   * Har so'rovda UPDATE yozish (daqiqasiga 120 tagacha) bazaga behuda yuk;
   * shu sabab akkaunt boshiga xotirada vaqt saqlanadi va 60 s da ko'pi bilan
   * bir marta yoziladi. Best-effort: xato faqat log'ga, so'rov to'xtamaydi.
   */
  touchLastUsed(id: string): void {
    try {
      const now = Date.now();
      const last = this.lastTouched.get(id);
      if (last !== undefined && now - last < LAST_USED_TOUCH_INTERVAL_MS) {
        return;
      }
      if (this.lastTouched.size >= LAST_USED_CACHE_MAX) {
        this.lastTouched.clear();
      }
      this.lastTouched.set(id, now);
      // `update()` hook'larni chaqirmaydi — `updated_at` (admin o'zgarishi)
      // texnik "oxirgi foydalanish" bilan aralashmaydi.
      void Promise.resolve(
        this.accountRepo.update({ id }, { last_used_at: now }),
      ).catch((err: unknown) =>
        this.logger.warn(
          `carrier ${id}: last_used_at yozilmadi — ${errorMessage(err)}`,
        ),
      );
    } catch (err) {
      this.logger.warn(
        `carrier ${id}: last_used_at yozilmadi — ${errorMessage(err)}`,
      );
    }
  }

  // ===================== ADMIN =====================

  /**
   * Akkaunt yaratadi va kuryerni bog'laydi. Ochiq kalit FAQAT shu javobda.
   *
   * Hammasi BITTA tranzaksiyada, kuryer qatori qulflangan holda — parallel
   * ikkinchi so'rov birinchisi tugashini kutadi va 409 oladi.
   *
   * ⚠️ NEGA KURYER "TOZA" BO'LISHI SHART (pochtasiz, kassa 0, provayderi yo'q):
   *   - eski pochtalardagi buyurtmalar birdan kompaniyaga "ko'rinib" qolardi
   *     (egalik `post.courier_id` bo'yicha) — ular boshqa odam qo'lida;
   *   - kassadagi eski qarz/haq kompaniya hisobiga aralashardi;
   *   - Elchi/LDG vakili (`external_provider`) egalik tekshiruvini chetlab
   *     o'tadi — undan carrier yasash hamma buyurtmani ochib qo'yardi.
   * Kontrakt ham shuni aytadi: "Elchi'da kurier akkaunti oching" — ya'ni yangi.
   */
  async create(
    input: CreateCarrierAccountInput,
    admin: JwtPayload,
  ): Promise<{ account: CarrierAccountView; api_key: string }> {
    const name = this.cleanName(input?.name);
    const courierId = String(input?.courier_id ?? '').trim();
    if (!UUID_RE.test(courierId)) {
      throw new BadRequestException("courier_id noto'g'ri (kuryer user UUID)");
    }
    const ipAllowlist =
      input?.ip_allowlist === undefined
        ? null
        : this.normalizeIpAllowlist(input.ip_allowlist);

    const apiKey = generateCarrierApiKey();
    // Hech kim bilmaydigan parol: bcrypt tranzaksiyadan OLDIN (≈70 ms) —
    // qulf ostida turmasin.
    const passwordHash = await this.bcrypt.encrypt(
      randomBytes(32).toString('base64url'),
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let saved: CarrierAccountEntity;
    let courier: UserEntity;
    let cashboxCreated = false;
    try {
      const manager = queryRunner.manager;
      const locked = await manager.findOne(UserEntity, {
        where: { id: courierId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Kuryer topilmadi');
      }
      courier = locked;

      const existing = await manager.findOne(CarrierAccountEntity, {
        where: { courier_user_id: courierId, is_deleted: false },
        select: ['id', 'name'],
      });
      if (existing) {
        throw new ConflictException(
          `Bu kuryer allaqachon "${existing.name}" carrier akkauntiga bog'langan. ` +
            `Kalit yo'qolgan bo'lsa — kalitni yangilang (rotate-key).`,
        );
      }

      this.assertBindableCourier(courier);

      const postCount = await manager.count(PostEntity, {
        where: { courier_id: courierId },
      });
      if (postCount > 0) {
        throw new BadRequestException(
          `Kuryerda ${postCount} ta pochta bor — carrier uchun YANGI (pochtasiz) kuryer oching`,
        );
      }

      /**
       * ⚠️ TIRIK SESSIYA. Parol almashtirilishi JWT'ni o'ldirmaydi: kimdir
       * (masalan admin sinab ko'rgan) shu kuryer bilan kirgan bo'lsa, uning
       * access tokeni bog'lashdan keyin ham ishlaydi va `/order/sell/:id`
       * orqali kalit, IP ro'yxati, akkaunt o'chirgichi va adapter pul
       * qoidalarini chetlab o'tadi (`extraCost` isbotsiz kassaga). Shu
       * sabab yaqinda kirilgan kuryer bog'lanmaydi — yangisi ochiladi.
       */
      const lookback = carrierBindLoginLookbackMs();
      const recentLogin = await manager.findOne(ActivityLogEntity, {
        where: {
          entity_type: 'user',
          entity_id: courierId,
          action: 'login',
          ...(lookback === null
            ? {}
            : { created_at: MoreThanOrEqual(Date.now() - lookback) }),
        },
        select: ['id', 'created_at'],
      });
      if (recentLogin) {
        throw new BadRequestException(
          "Bu kuryer akkauntiga yaqinda tizimga kirilgan — o'sha sessiya hali tirik bo'lishi va " +
            'API kalitisiz amal qilishi mumkin. Carrier uchun hech kim kirmagan YANGI kuryer oching',
        );
      }

      const cashbox = await manager.findOne(CashEntity, {
        where: { user_id: courierId, cashbox_type: Cashbox_type.FOR_COURIER },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        cashbox &&
        (Number(cashbox.balance) !== 0 ||
          Number(cashbox.balance_cash) !== 0 ||
          Number(cashbox.balance_card) !== 0)
      ) {
        throw new BadRequestException(
          'Kuryer kassasi 0 emas — carrier uchun YANGI kuryer oching yoki avval kassani yoping',
        );
      }
      // Kuryer kassasi sotuv oqimi uchun MAJBURIY (elchi-config `bindCourier` naqshi).
      if (!cashbox) {
        await manager.save(
          manager.create(CashEntity, {
            cashbox_type: Cashbox_type.FOR_COURIER,
            user_id: courierId,
          }),
        );
        cashboxCreated = true;
      }

      await manager.update(
        UserEntity,
        { id: courierId },
        {
          external_provider: CARRIER_EXTERNAL_PROVIDER,
          password: passwordHash,
          updated_at: Date.now(),
        },
      );
      courier.external_provider = CARRIER_EXTERNAL_PROVIDER;

      saved = await manager.save(
        manager.create(CarrierAccountEntity, {
          name,
          courier_user_id: courierId,
          api_key_hash: hashApiKey(apiKey),
          api_key_last4: apiKey.slice(-4),
          ip_allowlist: ipAllowlist,
          is_active: true,
          is_deleted: false,
          last_used_at: null,
          created_by: admin?.id ?? null,
        }),
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          "Bu kuryer allaqachon boshqa carrier akkauntiga bog'langan — ro'yxatdan topib kalitni yangilang",
        );
      }
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Kalit ham, xeshi ham LOG QILINMAYDI.
    await this.activityLog.log({
      entity_type: 'CarrierAccount',
      entity_id: saved.id,
      action: 'created',
      new_value: {
        name: saved.name,
        courier_user_id: saved.courier_user_id,
        ip_allowlist: saved.ip_allowlist,
        is_active: saved.is_active,
      },
      description: `Carrier akkaunt yaratildi: ${saved.name} (kuryer: ${courier.name})`,
      user: admin,
    });
    await this.activityLog.log({
      entity_type: 'user',
      entity_id: courier.id,
      action: 'carrier_bound',
      new_value: {
        external_provider: CARRIER_EXTERNAL_PROVIDER,
        carrier_account_id: saved.id,
        cashbox_created: cashboxCreated,
      },
      description:
        "Kuryer carrier akkauntiga bog'landi; paroli tasodifiy qilindi (tizimga kirish yopiq)",
      user: admin,
    });

    saved.courier = courier;
    return { account: this.toView(saved), api_key: apiKey };
  }

  async list(): Promise<CarrierAccountView[]> {
    const rows = await this.accountRepo.find({
      where: { is_deleted: false },
      relations: { courier: true },
      order: { created_at: 'DESC' },
    });
    return rows.map((row) => this.toView(row));
  }

  /**
   * Nom va IP ro'yxati. Kuryer va kalit bu yerda O'ZGARMAYDI: kuryer
   * almashsa — yangi akkaunt (eski buyurtma va kassa eski kuryerda qoladi);
   * kalit uchun `rotateKey`.
   *
   * Faqat O'ZGARGAN ustunlar yoziladi (to'liq `save(row)` emas): parallel
   * `status` / `rotate-key` bir-birining yozuvini eski qiymat bilan bosib
   * ketmasin (masalan o'chirilgan akkaunt qayta yoqilib qolmasin).
   */
  async update(
    id: string,
    input: UpdateCarrierAccountInput,
    admin: JwtPayload,
  ): Promise<CarrierAccountView> {
    if (input?.name === undefined && input?.ip_allowlist === undefined) {
      throw new BadRequestException(
        "O'zgartirish uchun hech qanday maydon berilmadi (name, ip_allowlist)",
      );
    }
    const row = await this.findRowOrFail(id);

    const changed: Partial<
      Pick<CarrierAccountEntity, 'name' | 'ip_allowlist'>
    > = {};
    if (input.name !== undefined) {
      const name = this.cleanName(input.name);
      if (name !== row.name) changed.name = name;
    }
    if (input.ip_allowlist !== undefined) {
      const list = this.normalizeIpAllowlist(input.ip_allowlist);
      if (!sameList(list, row.ip_allowlist)) changed.ip_allowlist = list;
    }
    if (!Object.keys(changed).length) {
      return this.toView(row);
    }

    const result = await this.accountRepo.update(
      { id: row.id, is_deleted: false },
      { ...changed, updated_at: Date.now() },
    );
    if (!result.affected) {
      throw new NotFoundException('Carrier akkaunt topilmadi');
    }

    await this.activityLog.log({
      entity_type: 'CarrierAccount',
      entity_id: row.id,
      action: 'updated',
      old_value: pick(row, Object.keys(changed)),
      new_value: changed,
      description: `Carrier akkaunt yangilandi: ${changed.name ?? row.name}`,
      user: admin,
    });
    return this.toView(await this.findRowOrFail(row.id));
  }

  /**
   * Yangi kalit — eski kalit DARHOL ishlamay qoladi (xesh almashadi).
   * Bloklangan/o'chirilgan (yoki provayderi o'zgartirilgan) kuryerga yangi
   * kalit chiqarilmaydi — Elchi bilan bir xil.
   */
  async rotateKey(
    id: string,
    admin: JwtPayload,
  ): Promise<{ account: CarrierAccountView; api_key: string }> {
    const row = await this.findRowOrFail(id);
    this.assertCourierActiveForAccount(row);

    const apiKey = generateCarrierApiKey();
    const result = await this.accountRepo.update(
      { id: row.id, is_deleted: false },
      {
        api_key_hash: hashApiKey(apiKey),
        api_key_last4: apiKey.slice(-4),
        updated_at: Date.now(),
      },
    );
    if (!result.affected) {
      throw new NotFoundException('Carrier akkaunt topilmadi');
    }

    await this.activityLog.log({
      entity_type: 'CarrierAccount',
      entity_id: row.id,
      action: 'key_rotated',
      new_value: { key_rotated: true },
      description: `Carrier kaliti yangilandi: ${row.name} (eski kalit bekor)`,
      user: admin,
    });
    return {
      account: this.toView(await this.findRowOrFail(row.id)),
      api_key: apiKey,
    };
  }

  /**
   * Faol emas akkaunt bilan `/carrier/*` → 403. Yoqishda bog'langan kuryer
   * faol bo'lishi shart (bloklangan kuryer kaliti qayta tirilmasin).
   */
  async setActive(
    id: string,
    isActive: boolean,
    admin: JwtPayload,
  ): Promise<CarrierAccountView> {
    if (typeof isActive !== 'boolean') {
      throw new BadRequestException("is_active boolean bo'lishi kerak");
    }
    const row = await this.findRowOrFail(id);
    if (isActive) {
      this.assertCourierActiveForAccount(row);
    }
    if (row.is_active === isActive) {
      return this.toView(row);
    }

    const result = await this.accountRepo.update(
      { id: row.id, is_deleted: false },
      { is_active: isActive, updated_at: Date.now() },
    );
    if (!result.affected) {
      throw new NotFoundException('Carrier akkaunt topilmadi');
    }

    await this.activityLog.log({
      entity_type: 'CarrierAccount',
      entity_id: row.id,
      action: isActive ? 'activated' : 'deactivated',
      old_value: { is_active: row.is_active },
      new_value: { is_active: isActive },
      description: `Carrier akkaunt ${isActive ? 'yoqildi' : "o'chirildi"}: ${row.name}`,
      user: admin,
    });
    return this.toView(await this.findRowOrFail(row.id));
  }

  /**
   * Yumshoq o'chirish + kuryerni bo'shatish, BITTA tranzaksiyada.
   *
   * ⚠️ `external_provider` NULL qilinadi (faqat hali `'carrier'` bo'lsa —
   * orada Elchi/LDG ga o'tkazilgan bo'lsa, unga tegmaymiz). Aks holda
   * shtraf istisnosi va avtomatik qo'shimcha xarajat siyosati o'chirilgan
   * akkaunt kuryerida yoqiq qolardi.
   *
   * Kuryerning pochtalari, buyurtmalari va kassasi O'ZGARMAYDI — ularni
   * xodimlar odatdagi oqim bilan (boshqa kuryerga o'tkazish, kassa
   * topshirish) yopadi. Kuryer paroli tasodifiyligicha qoladi.
   */
  async remove(
    id: string,
    admin: JwtPayload,
  ): Promise<{ id: string; deleted: true; courier_released: boolean }> {
    if (!UUID_RE.test(String(id ?? ''))) {
      throw new NotFoundException('Carrier akkaunt topilmadi');
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let row: CarrierAccountEntity;
    let released = false;
    try {
      const manager = queryRunner.manager;
      const locked = await manager.findOne(CarrierAccountEntity, {
        where: { id, is_deleted: false },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Carrier akkaunt topilmadi');
      }
      row = locked;
      const now = Date.now();
      await manager.update(
        CarrierAccountEntity,
        { id: row.id },
        { is_deleted: true, is_active: false, updated_at: now },
      );
      const reset = await manager.update(
        UserEntity,
        {
          id: row.courier_user_id,
          external_provider: CARRIER_EXTERNAL_PROVIDER,
        },
        { external_provider: null, updated_at: now },
      );
      released = !!reset.affected;
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    this.lastTouched.delete(row.id);

    await this.activityLog.log({
      entity_type: 'CarrierAccount',
      entity_id: row.id,
      action: 'deleted',
      old_value: { is_active: row.is_active, is_deleted: false },
      new_value: { is_active: false, is_deleted: true },
      description: `Carrier akkaunt o'chirildi: ${row.name}`,
      user: admin,
    });
    if (released) {
      await this.activityLog.log({
        entity_type: 'user',
        entity_id: row.courier_user_id,
        action: 'carrier_unbound',
        old_value: { external_provider: CARRIER_EXTERNAL_PROVIDER },
        new_value: { external_provider: null },
        description: "Kuryer carrier akkauntidan bo'shatildi",
        user: admin,
      });
    }
    return { id: row.id, deleted: true, courier_released: released };
  }

  // ===================== YORDAMCHI =====================

  private async findRowOrFail(id: string): Promise<CarrierAccountEntity> {
    // Yaroqsiz UUID bazaga yetsa 22P02 (500) berardi — 404 bilan bir xil.
    if (!UUID_RE.test(String(id ?? ''))) {
      throw new NotFoundException('Carrier akkaunt topilmadi');
    }
    const row = await this.accountRepo.findOne({
      where: { id, is_deleted: false },
      relations: { courier: true },
    });
    if (!row) {
      throw new NotFoundException('Carrier akkaunt topilmadi');
    }
    return row;
  }

  private cleanName(raw: unknown): string {
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name) {
      throw new BadRequestException("name bo'sh bo'lishi mumkin emas");
    }
    if (name.length > NAME_MAX_LENGTH) {
      throw new BadRequestException(
        `name ${NAME_MAX_LENGTH} belgidan oshmasin`,
      );
    }
    return name;
  }

  /**
   * IP ro'yxatini tekshiradi va kanonik shaklga keltiradi. `null` / bo'sh —
   * cheklov yo'q. Tushunilmagan yozuv — 400 (yolg'on cheklov saqlanmaydi:
   * aks holda u hech qachon mos kelmay, kompaniya jimgina 403 olardi).
   */
  private normalizeIpAllowlist(value: unknown): string[] | null {
    if (value === null) return null;
    if (!Array.isArray(value)) {
      throw new BadRequestException("ip_allowlist massiv bo'lishi kerak");
    }
    if (value.length > IP_ALLOWLIST_MAX_ENTRIES) {
      throw new BadRequestException(
        `ip_allowlist ${IP_ALLOWLIST_MAX_ENTRIES} tadan ko'p bo'lmasin`,
      );
    }
    const { rules, invalid } = normalizeIpAllowlistRules(value);
    if (invalid.length) {
      throw new BadRequestException(
        `ip_allowlist da tushunilmagan yozuv: ${invalid.join(', ')}. ` +
          "Qabul qilinadi: IPv4 (203.0.113.10), IPv4 diapazon (203.0.113.0/24), IPv6 manzil (IPv6 diapazon yo'q)",
      );
    }
    return rules.length ? rules : null;
  }

  private assertBindableCourier(user: UserEntity): void {
    if (user.is_deleted) {
      throw new BadRequestException("Kuryer o'chirilgan");
    }
    if (user.role !== Roles.COURIER) {
      throw new BadRequestException(
        "Faqat COURIER rolidagi foydalanuvchini carrier akkauntiga bog'lash mumkin",
      );
    }
    if (user.status !== Status.ACTIVE) {
      throw new BadRequestException('Kuryer faol emas (bloklangan)');
    }
    if (user.external_provider) {
      throw new BadRequestException(
        `Kuryer allaqachon "${user.external_provider}" provayderiga bog'langan — ` +
          'carrier uchun YANGI kuryer oching',
      );
    }
  }

  private assertCourierActiveForAccount(row: CarrierAccountEntity): void {
    if (!isActiveCarrierCourier(row.courier)) {
      throw new BadRequestException(
        "Bog'langan kuryer faol emas (bloklangan, o'chirilgan yoki boshqa provayderga o'tkazilgan) — " +
          'kalit berilmaydi',
      );
    }
  }

  private toView(row: CarrierAccountEntity): CarrierAccountView {
    const courier = row.courier;
    return {
      id: row.id,
      name: row.name,
      courier_user_id: row.courier_user_id,
      courier: courier
        ? {
            id: courier.id,
            name: courier.name,
            phone_number: courier.phone_number,
            status: courier.status,
          }
        : null,
      api_key_masked: maskCarrierApiKey(row.api_key_last4),
      ip_allowlist: row.ip_allowlist ?? null,
      is_active: row.is_active,
      last_used_at: row.last_used_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; driverError?: { code?: string } };
  return e?.code === '23505' || e?.driverError?.code === '23505';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sameList(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return (
    left.length === right.length && left.every((item, i) => item === right[i])
  );
}

function pick(
  source: CarrierAccountEntity,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = (source as unknown as Record<string, unknown>)[key];
  }
  return out;
}
