import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { ElchiConfigEntity } from 'src/core/entity/elchi-config.entity';
import { ElchiDistrictMapEntity } from 'src/core/entity/elchi-district-map.entity';
import { DistrictEntity } from 'src/core/entity/district.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { Cashbox_type, Roles } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ElchiApiService } from './elchi-api.service';
import { UpdateElchiConfigDto } from './dto/elchi-config.dto';

/** Elchi sozlamasida HECH QACHON loglanmaydigan maxfiy maydonlar. */
const ELCHI_CONFIG_SECRET_FIELDS = new Set([
  'api_key',
  'webhook_secret',
  'webhook_secret_previous',
]);

export interface ElchiDistrictSyncResult {
  /** SOATO bo'yicha yangi moslangan tumanlar soni. */
  matched: number;
  /** Avval avtomatik moslangan va yangilangan (Elchi id o'zgargan) soni. */
  refreshed: number;
  /** Qo'lda moslangani uchun TEGILMAGAN soni. */
  kept_manual: number;
  /** Elchi tomonda mos SOATO topilmagan tumanlar. */
  unmatched: Array<{ district_id: string; name: string; sato_code: string | null }>;
}

@Injectable()
export class ElchiConfigService {
  private readonly logger = new Logger(ElchiConfigService.name);

  constructor(
    @InjectRepository(ElchiConfigEntity)
    private readonly repo: Repository<ElchiConfigEntity>,
    @InjectRepository(ElchiDistrictMapEntity)
    private readonly mapRepo: Repository<ElchiDistrictMapEntity>,
    @InjectRepository(DistrictEntity)
    private readonly districtRepo: Repository<DistrictEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly api: ElchiApiService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ===================== SOZLAMA =====================

  /** Singleton qatorni topib qaytaradi; bo'lmasa yaratadi (default qiymatlar). */
  async getOrCreate(): Promise<ElchiConfigEntity> {
    let config = await this.repo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (!config) {
      config = this.repo.create({});
      await this.repo.save(config);
    }
    return config;
  }

  /**
   * Admin panel uchun xavfsiz ko'rinish: maxfiy maydonlar QAYTARILMAYDI,
   * o'rniga `*_set` bayroqlari.
   */
  async getSafe(): Promise<Record<string, unknown>> {
    const config = await this.getOrCreate();
    const {
      api_key,
      webhook_secret,
      webhook_secret_previous,
      setCreationTimestamps: _ct,
      setUpdateTimestamp: _ut,
      ...rest
    } = config;
    void _ct;
    void _ut;
    return {
      ...rest,
      api_key_set: !!api_key,
      webhook_secret_set: !!webhook_secret,
      webhook_secret_previous_set: !!webhook_secret_previous,
    };
  }

  /**
   * Sozlamani yangilaydi.
   *
   * Audit: maxfiy maydonlarning QIYMATI hech qachon loglanmaydi — faqat
   * "o'zgardi" bayrog'i (`masked_fields`). Bu activity-log konvensiyasi.
   */
  async update(
    dto: UpdateElchiConfigDto,
    user?: JwtPayload,
  ): Promise<ElchiConfigEntity> {
    const config = await this.getOrCreate();

    const oldNonSecret: Record<string, unknown> = {};
    const newNonSecret: Record<string, unknown> = {};
    const maskedFields: string[] = [];

    for (const key of Object.keys(dto)) {
      const value = (dto as Record<string, unknown>)[key];
      if (value === undefined) continue;

      if (ELCHI_CONFIG_SECRET_FIELDS.has(key)) {
        maskedFields.push(key);
      } else {
        oldNonSecret[key] = (config as unknown as Record<string, unknown>)[key];
        newNonSecret[key] = value;
      }
      (config as unknown as Record<string, unknown>)[key] = value;
    }

    const saved = await this.repo.save(config);

    // Konvensiya (LDG bilan bir xil): maxfiy maydon QIYMATI emas, nomi
    // `new_value.masked_fields` ichida yoziladi.
    await this.activityLog.log({
      entity_type: 'elchi_config',
      entity_id: saved.id,
      action: 'config_changed',
      old_value: oldNonSecret,
      new_value: {
        ...newNonSecret,
        ...(maskedFields.length ? { masked_fields: maskedFields } : {}),
      },
      description: `Elchi sozlamasi o'zgartirildi${
        maskedFields.length ? ` (maxfiy: ${maskedFields.join(', ')})` : ''
      }`,
      user,
    });

    return saved;
  }

  /**
   * Ulanishni tekshirish (`GET /partner/ping`).
   *
   * ATAYLAB master kalitga bog'lanmagan: sozlashni yakunlash uchun operator
   * integratsiya hali o'chirilgan holatda ham kalitni sinab ko'rishi kerak.
   */
  async testConnection(): Promise<{
    ok: boolean;
    partner?: { id?: string; name?: string };
  }> {
    const res = await this.api.ping();
    const config = await this.getOrCreate();
    config.last_ping_at = Date.now();
    await this.repo.save(config);
    return { ok: !!res?.authenticated, partner: res?.partner };
  }

  /**
   * Mavjud kuryerni Elchi VAKIL-kuryeri qilib biriktiradi.
   *
   * Nima bo'ladi:
   *   - `users.external_provider = 'elchi'` belgilanadi (bir vaqtda FAQAT bitta
   *     vakil bo'lishi kafolatlanadi — oldingisidan olib tashlanadi);
   *   - kassasi yo'q bo'lsa `FOR_COURIER` kassa yaratiladi. Bu ZARUR: sotuv
   *     oqimi kuryer kassasini talab qiladi;
   *   - `elchi_config.elchi_courier_user_id` ga yoziladi.
   *
   * ⚠️ TARIF — bu kuryerning `tariff_home`/`tariff_center` qiymati biz Elchi'ga
   * to'laydigan yetkazish haqi. U Elchi tomonidagi "BeePost" market tarifiga
   * TENG bo'lishi shart, aks holda ikki daftar ajraladi (M4). Tarif oddiy
   * foydalanuvchi tahrirlash oqimidan belgilanadi.
   *
   * ⚠️ DIQQAT: bu akkaunt PRIVILEGIYALANGAN — `assertCourierOwnsOrder` tashqi
   * provayder aktyori uchun egalik tekshiruvini o'tkazib yuboradi. Kredensiallar
   * tashqi tomonga BERILMASLIGI kerak; boshqaruv webhook orqali kechadi.
   */
  async bindCourier(
    userId: string,
    user?: JwtPayload,
  ): Promise<{ user_id: string; bound: boolean }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const target = await queryRunner.manager.findOne(UserEntity, {
        where: { id: userId },
      });
      if (!target) {
        throw new NotFoundException('Foydalanuvchi topilmadi');
      }
      if (target.role !== Roles.COURIER) {
        throw new BadRequestException(
          "Faqat COURIER rolidagi foydalanuvchini Elchi vakili qilib bo'ladi",
        );
      }

      // Bitta vakil qoidasi — oldingisini bo'shatamiz.
      const previous = await queryRunner.manager.findOne(UserEntity, {
        where: { external_provider: 'elchi', id: Not(target.id) },
      });
      if (previous) {
        previous.external_provider = null;
        await queryRunner.manager.save(previous);
      }

      target.external_provider = 'elchi';
      await queryRunner.manager.save(target);

      // Kuryer kassasi — sotuv oqimi uchun MAJBURIY.
      const existingCashbox = await queryRunner.manager.findOne(CashEntity, {
        where: { user_id: target.id, cashbox_type: Cashbox_type.FOR_COURIER },
      });
      if (!existingCashbox) {
        const cashbox = queryRunner.manager.create(CashEntity, {
          cashbox_type: Cashbox_type.FOR_COURIER,
          user_id: target.id,
        });
        await queryRunner.manager.save(cashbox);
      }

      let config = await queryRunner.manager.findOne(ElchiConfigEntity, {
        where: {},
        order: { created_at: 'ASC' },
      });
      if (!config) {
        config = queryRunner.manager.create(ElchiConfigEntity, {});
      }
      config.elchi_courier_user_id = target.id;
      await queryRunner.manager.save(config);

      await queryRunner.commitTransaction();

      await this.activityLog.log({
        entity_type: 'elchi_config',
        entity_id: config.id,
        action: 'courier_bound',
        new_value: { elchi_courier_user_id: target.id },
        description: `Elchi vakil-kuryeri biriktirildi: ${target.name}`,
        user,
      });

      return { user_id: target.id, bound: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ===================== TAYYORLIK TEKSHIRUVI =====================

  /**
   * Sozlash tayyorligi cheklisti — admin panel shu ro'yxatni ko'rsatadi.
   *
   * ⚠️ ENG MUHIM BAND — TARIF MOSLIGI.
   *
   * "Elchi yetkazish haqi" bitta narsa, lekin IKKI joyda yozilgan:
   *   1. bizda — "Elchi" virtual kuryerining tarifi (biz Elchi'ga to'laymiz);
   *   2. Elchi'da — "BeePost" market akkauntining tarifi (Elchi bizdan oladi).
   *
   * Ular teng bo'lmasa HECH QANDAY XATO CHIQMAYDI — ikki tizim ham "to'g'ri"
   * ishlaydi, shunchaki boshqa raqam bilan. Farq har buyurtmada jimgina
   * to'planadi va faqat oy oxirida "tushunarsiz farq" bo'lib ko'rinadi.
   *
   * Shu bois raqamni odamdan so'rash o'rniga MASHINA solishtiradi: Elchi
   * tarifini `GET /partner/tariff` bilan o'qib, bizdagi bilan tenglashtiramiz.
   * Tarif istalgan vaqtda o'zgarishi mumkin — o'zgargach bu tekshiruv darhol
   * nomuvofiqlikni ko'rsatadi.
   *
   * DIQQAT: Elchi tomonidagi tarifni Partner API orqali O'ZGARTIRIB BO'LMAYDI
   * (u faqat market ochilganda yuboriladi). Keyingi o'zgarishlar Elchi'ning
   * o'z admin panelidan qilinadi — shu bois bu tekshiruv doimiy kerak.
   */
  async getReadiness(): Promise<{
    ready: boolean;
    checks: Array<{ key: string; ok: boolean; detail: string }>;
  }> {
    const config = await this.getOrCreate();
    const checks: Array<{ key: string; ok: boolean; detail: string }> = [];

    const push = (key: string, ok: boolean, detail: string) =>
      checks.push({ key, ok, detail });

    push(
      'api_base_url',
      !!config.api_base_url,
      config.api_base_url ?? 'kiritilmagan',
    );
    push('api_key', !!config.api_key, config.api_key ? 'kiritilgan' : "yo'q");
    push(
      'webhook_secret',
      !!config.webhook_secret,
      config.webhook_secret ? 'kiritilgan' : "yo'q",
    );
    push(
      'elchi_market_id',
      !!config.elchi_market_id,
      config.elchi_market_id ?? 'market akkaunti ochilmagan',
    );

    // Virtual kuryer + uning tarifi
    let courier: UserEntity | null = null;
    if (config.elchi_courier_user_id) {
      courier = await this.userRepo.findOne({
        where: { id: config.elchi_courier_user_id },
      });
    }
    push(
      'virtual_courier',
      !!courier && courier.status === 'active',
      courier
        ? `${courier.name} (${courier.status})`
        : 'vakil-kuryer biriktirilmagan',
    );

    // Tumanlar: moslangan va RUXSAT berilgan
    const [mappedCount, enabledCount] = await Promise.all([
      this.mapRepo.count(),
      this.mapRepo.count({ where: { is_enabled: true } }),
    ]);
    push(
      'districts',
      enabledCount > 0,
      `moslangan: ${mappedCount}, ruxsat berilgan: ${enabledCount}`,
    );

    // Ulanish + TARIF MOSLIGI (tashqi so'rov — xatoni ushlab, banddan
    // "muvaffaqiyatsiz" deb belgilaymiz, butun tekshiruvni yiqitmaymiz).
    if (config.api_base_url && config.api_key) {
      try {
        const ping = await this.api.ping();
        push('connection', !!ping?.authenticated, 'ulanish ishlaydi');
      } catch (error) {
        push(
          'connection',
          false,
          error instanceof Error ? error.message : String(error),
        );
      }
    } else {
      push('connection', false, 'kalit yoki manzil yetishmaydi');
    }

    if (config.elchi_market_id && courier) {
      await this.checkTariffMatch(config.elchi_market_id, courier, push);
    } else {
      push('tariff_match', false, 'market yoki vakil-kuryer sozlanmagan');
    }

    return { ready: checks.every((c) => c.ok), checks };
  }

  /**
   * PCS virtual kuryer tarifi ↔ Elchi market tarifi.
   * Ikki yo'nalish alohida tekshiriladi (uyga va markazga).
   */
  private async checkTariffMatch(
    elchiMarketId: string,
    courier: UserEntity,
    push: (key: string, ok: boolean, detail: string) => void,
  ): Promise<void> {
    try {
      const [home, center] = await Promise.all([
        this.api.getTariff(elchiMarketId, 'address'),
        this.api.getTariff(elchiMarketId, 'center'),
      ]);

      const ours = {
        home: Number(courier.tariff_home ?? 0),
        center: Number(courier.tariff_center ?? 0),
      };
      const theirs = {
        home: Number(home?.market_tariff ?? 0),
        center: Number(center?.market_tariff ?? 0),
      };

      const homeOk = ours.home === theirs.home;
      const centerOk = ours.center === theirs.center;

      push(
        'tariff_match',
        homeOk && centerOk,
        homeOk && centerOk
          ? `mos: uyga ${ours.home}, markazga ${ours.center}`
          : `NOMUVOFIQ — uyga: bizda ${ours.home} / Elchi'da ${theirs.home}; ` +
            `markazga: bizda ${ours.center} / Elchi'da ${theirs.center}. ` +
            `Har buyurtmada farq to'planadi — tuzatilishi shart.`,
      );

      if (!homeOk || !centerOk) {
        this.logger.error(
          `Elchi TARIF NOMUVOFIQLIGI — uyga ${ours.home}/${theirs.home}, ` +
            `markazga ${ours.center}/${theirs.center}`,
        );
      }
    } catch (error) {
      push(
        'tariff_match',
        false,
        `Elchi tarifini o'qib bo'lmadi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // ===================== TUMAN MOSLAMASI =====================

  /** Moslama jadvali (admin panelda ko'rsatish uchun, tuman nomi bilan). */
  async listDistrictMap(): Promise<ElchiDistrictMapEntity[]> {
    return this.mapRepo.find({
      relations: ['district'],
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Elchi hududlarini tortib olib, SOATO bo'yicha AVTOMATIK moslaydi.
   *
   * INVARIANTLAR (buzilmasligi shart):
   *   1. `is_enabled` HECH QACHON o'zgartirilmaydi. Moslash — texnik amal;
   *      jo'natishga ruxsat berish — operatorning ATAYLAB qilgan qarori.
   *      Aks holda "moslashni yangilash" tugmasi bilvosita darvozani ochib
   *      yuborishi mumkin edi.
   *   2. QO'LDA moslangan qatorlar (`matched_automatically = false` va Elchi
   *      id'si bor) ustidan yozilmaydi — operator tuzatgan narsa saqlanadi.
   *
   * Moslanmagan tumanlar javobda qaytariladi — operator ularni qo'lda
   * moslashi kerak (yoki ular pilotga kirmaydi).
   */
  async syncDistricts(user?: JwtPayload): Promise<ElchiDistrictSyncResult> {
    const [elchiDistricts, ourDistricts, existingRows] = await Promise.all([
      this.api.getDistricts(),
      this.districtRepo.find({ select: ['id', 'name', 'sato_code'] }),
      this.mapRepo.find(),
    ]);

    // Elchi tomonidagi SOATO → tuman indeksi. Bir SOATO bir necha marta
    // kelsa BIRINCHISI olinadi va bu holat log qilinadi (Elchi ma'lumotida
    // dublikat bor degani — jimgina o'tkazib yubormaymiz).
    const bySato = new Map<string, { id: string; region_id: string }>();
    for (const d of elchiDistricts) {
      const code = String(d.sato_code ?? '').trim();
      if (!code) continue;
      if (bySato.has(code)) {
        this.logger.warn(
          `Elchi tumanlarida takroriy SOATO: ${code} (birinchisi olindi)`,
        );
        continue;
      }
      bySato.set(code, { id: String(d.id), region_id: String(d.region_id) });
    }

    const rowByDistrict = new Map(
      existingRows.map((row) => [String(row.district_id), row]),
    );

    const result: ElchiDistrictSyncResult = {
      matched: 0,
      refreshed: 0,
      kept_manual: 0,
      unmatched: [],
    };

    for (const ours of ourDistricts) {
      const code = String(ours.sato_code ?? '').trim();
      const remote = code ? bySato.get(code) : undefined;
      const existing = rowByDistrict.get(String(ours.id));

      if (!remote) {
        result.unmatched.push({
          district_id: String(ours.id),
          name: ours.name,
          sato_code: ours.sato_code ?? null,
        });
        continue;
      }

      // Qo'lda moslangan qatorga TEGMAYMIZ.
      if (existing && !existing.matched_automatically && existing.elchi_district_id) {
        result.kept_manual += 1;
        continue;
      }

      if (!existing) {
        await this.mapRepo.save(
          this.mapRepo.create({
            district_id: String(ours.id),
            elchi_district_id: remote.id,
            elchi_region_id: remote.region_id,
            sato_code: code,
            matched_automatically: true,
            // is_enabled: ATAYLAB berilmaydi -> entity default `false`.
          }),
        );
        result.matched += 1;
        continue;
      }

      const changed =
        existing.elchi_district_id !== remote.id ||
        existing.elchi_region_id !== remote.region_id ||
        existing.sato_code !== code;
      if (changed) {
        existing.elchi_district_id = remote.id;
        existing.elchi_region_id = remote.region_id;
        existing.sato_code = code;
        existing.matched_automatically = true;
        // is_enabled TEGILMAYDI (invariant 1).
        await this.mapRepo.save(existing);
        result.refreshed += 1;
      }
    }

    await this.activityLog.log({
      entity_type: 'elchi_district_map',
      entity_id: 'sync',
      action: 'districts_synced',
      new_value: {
        matched: result.matched,
        refreshed: result.refreshed,
        kept_manual: result.kept_manual,
        unmatched_count: result.unmatched.length,
      },
      description: "Elchi tumanlari SOATO bo'yicha moslashtirildi",
      user,
    });

    return result;
  }

  /**
   * DARVOZA kaliti: shu tumandagi buyurtmalar Elchi'ga jo'natilishi mumkinmi.
   *
   * Moslama yo'q bo'lsa yoqib bo'lmaydi — aks holda jo'natishda Elchi
   * `district_id`si bo'lmagan posilka yaratishga urinilardi.
   */
  async setDistrictEnabled(
    districtId: string,
    enabled: boolean,
    user?: JwtPayload,
  ): Promise<ElchiDistrictMapEntity> {
    const row = await this.mapRepo.findOne({
      where: { district_id: districtId },
    });
    if (!row) {
      throw new NotFoundException(
        "Bu tuman uchun Elchi moslamasi yo'q — avval moslashtiring",
      );
    }
    if (enabled && !row.elchi_district_id) {
      throw new NotFoundException(
        "Tuman Elchi tumaniga moslanmagan — yoqib bo'lmaydi",
      );
    }

    const before = row.is_enabled;
    row.is_enabled = enabled;
    const saved = await this.mapRepo.save(row);

    await this.activityLog.log({
      entity_type: 'elchi_district_map',
      entity_id: saved.id,
      action: 'district_gate_changed',
      old_value: { is_enabled: before },
      new_value: { is_enabled: enabled },
      description: enabled
        ? "Tuman Elchi'ga jo'natishga ruxsat oldi"
        : "Tumanda Elchi'ga jo'natish bloklandi",
      user,
    });

    return saved;
  }

  /**
   * DARVOZA TEKSHIRUVI — dispatch qatlami shuni chaqiradi.
   *
   * `true` faqat: moslama bor + Elchi tumani belgilangan + `is_enabled`.
   * Moslama jadvali bo'sh bo'lsa hamma tuman bloklangan (xavfsiz standart).
   */
  async isDistrictAllowed(districtId: string): Promise<boolean> {
    if (!districtId) return false;
    const row = await this.mapRepo.findOne({
      where: { district_id: districtId, is_enabled: true },
    });
    return !!row?.elchi_district_id;
  }

  /** Dispatch uchun Elchi hudud id'lari (moslama bo'lmasa `null`). */
  async resolveElchiGeo(
    districtId: string,
  ): Promise<{ elchi_district_id: string; elchi_region_id: string | null } | null> {
    const row = await this.mapRepo.findOne({
      where: { district_id: districtId, is_enabled: true },
    });
    if (!row?.elchi_district_id) return null;
    return {
      elchi_district_id: row.elchi_district_id,
      elchi_region_id: row.elchi_region_id,
    };
  }
}
