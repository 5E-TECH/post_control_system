import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
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
  unmatched: Array<{
    district_id: string;
    name: string;
    sato_code: string | null;
  }>;
}

/**
 * Tuman nomini solishtirish uchun normallashtiradi: qo'shimchalar
 * (`tumani`/`shahri`) tushadi, apostrof variantlari va `x`/`h` tenglashadi.
 */
function normalizeDistrictName(name: unknown): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/(tumani|tuman|shahri|shahar)/g, '')
    .replace(/x/g, 'h')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Nom lotin-o'zbek imlosiga qanchalik o'xshashligi.
 *
 * Takroriy SOATO'da ikki yozuv bir joyni bildiradi, lekin biri eski ruscha
 * transliteratsiya bo'ladi ("Akaltyn"), ikkinchisi to'g'ri o'zbekcha nom
 * ("Oqoltin"). Tanlov id yoki massiv tartibiga tayansa, NOTO'G'RI nom
 * tanlanib qolishi mumkin — shuning uchun imlo belgilariga qaraymiz.
 */
function uzbekLatinScore(name: unknown): number {
  const s = String(name ?? '');
  let score = 0;
  if (/[oOgG]['ʻʼ`]/.test(s)) score += 2; // o', g'
  if (/q/i.test(s)) score += 1; // ruscha transliteratsiyada `k` bo'lardi
  if (/(yn|yy|iy)$/i.test(s)) score -= 1; // "-yn" ruscha oxirlanish
  return score;
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
  /**
   * ELCHI TOMONIDAGI tumanlar ro'yxati — qo'lda moslash uchun.
   *
   * ⚠️ NEGA KERAK BO'LDI. Qo'lda moslash backendi bor edi, lekin operator
   * Elchi tumanining UUID'ini QAYERDAN olishini hech kim aytmagan. Ro'yxat
   * bo'lmasa UI'da xom UUID yozish qoladi — bu amalda ishlamaydi va shu
   * sababdan frontend umuman yozilmagan edi.
   *
   * Faqat o'qish: Elchi'ning ommaviy `GET /partner/districts` yo'liga
   * murojaat qiladi va hech narsani saqlamaydi.
   */
  async listRemoteDistricts(): Promise<
    Array<{
      id: string;
      name: string;
      region_id: string;
      sato_code: string | null;
    }>
  > {
    const rows = await this.api.getDistricts();
    return rows.map((d) => ({
      id: String(d.id),
      name: String(d.name ?? ''),
      region_id: String(d.region_id ?? ''),
      sato_code: d.sato_code != null ? String(d.sato_code) : null,
    }));
  }

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

    /**
     * Elchi tomonidagi SOATO → tuman(lar) indeksi.
     *
     * ⚠️ Bir SOATO bir necha marta kelishi MUMKIN — Elchi bazasida bir joy
     * ikki nom bilan yozilgan bo'lishi mumkin (masalan `1724206` uchun
     * "Oqoltin" va "Akaltyn").
     *
     * Ilgari bunda "massivdagi BIRINCHISI" olinardi. Bu yashirin xato edi:
     * API javobining tartibi KAFOLATLANMAGAN, ya'ni keyingi moslashda
     * ikkinchi nomzod birinchi kelib qolsa, tizim mavjud bog'lanishni
     * sababsiz BOSHQASIGA ko'chirardi. Yetkazish manzili o'zgarmasdi
     * (SOATO bir xil), lekin Elchi hisobotida bitta tuman ikkiga bo'linardi
     * va bog'lanish har sinxronda sakrab turardi.
     *
     * Endi barcha nomzodlar saqlanadi va tanlov `resolveRemote` da
     * BARQAROR qilinadi.
     */
    const bySato = new Map<
      string,
      Array<{ id: string; region_id: string; name: string }>
    >();
    for (const d of elchiDistricts) {
      const code = String(d.sato_code ?? '').trim();
      if (!code) continue;
      const entry = {
        id: String(d.id),
        region_id: String(d.region_id),
        name: String(d.name ?? ''),
      };
      const list = bySato.get(code);
      if (list) {
        list.push(entry);
        this.logger.warn(
          `Elchi tumanlarida takroriy SOATO: ${code} — ${list.length} ta nomzod`,
        );
      } else {
        bySato.set(code, [entry]);
      }
    }
    /**
     * Barqaror tartib. Uch bosqichli, ataylab shu ketma-ketlikda:
     *
     *  1. Bizda ham AYNI nom bilan turgan yozuv — eng ishonchli belgi.
     *  2. Lotin-o'zbek imlosi (`q`, `o'`, `g'`) — ruscha transliteratsiya
     *     emas. `1724206` uchun aynan shu holat: "Oqoltin" to'g'ri nom,
     *     "Akaltyn" esa eski ruscha yozuv. Eng kichik id bo'yicha tanlasak,
     *     yangi muhitda NOTO'G'RI nom tanlanardi.
     *  3. Id — hech narsa ajratmasa, hech bo'lmasa natija TAKRORLANUVCHI
     *     bo'lsin (API javobining tartibi kafolatlanmagan).
     */
    const ourNameBySato = new Map(
      ourDistricts.map((d) => [
        String(d.sato_code ?? '').trim(),
        normalizeDistrictName(d.name),
      ]),
    );
    for (const [code, list] of bySato.entries()) {
      const ourName = ourNameBySato.get(code);
      list.sort((a, b) => {
        const an = normalizeDistrictName(a.name);
        const bn = normalizeDistrictName(b.name);
        if (ourName) {
          const am = an === ourName ? 0 : 1;
          const bm = bn === ourName ? 0 : 1;
          if (am !== bm) return am - bm;
        }
        const au = uzbekLatinScore(a.name);
        const bu = uzbekLatinScore(b.name);
        if (au !== bu) return bu - au;
        return Number(a.id) - Number(b.id);
      });
    }

    /**
     * Nomzodlardan BITTASINI tanlaydi.
     *
     * Mavjud moslama nomzodlardan biriga allaqachon ishora qilayotgan bo'lsa —
     * O'SHA saqlanadi. Ya'ni bir marta o'rnatilgan bog'lanish takroriy
     * sinxronlarda sakramaydi. Aks holda yuqoridagi tartib bo'yicha eng
     * yaxshisi olinadi.
     */
    const resolveRemote = (
      candidates: Array<{ id: string; region_id: string; name: string }>,
      currentId?: string | null,
    ) =>
      candidates.find((c) => c.id === String(currentId ?? '')) ?? candidates[0];

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
      const existing = rowByDistrict.get(String(ours.id));
      const candidates = code ? bySato.get(code) : undefined;
      const remote = candidates?.length
        ? resolveRemote(candidates, existing?.elchi_district_id)
        : undefined;

      if (!remote) {
        result.unmatched.push({
          district_id: String(ours.id),
          name: ours.name,
          sato_code: ours.sato_code ?? null,
        });
        continue;
      }

      // Qo'lda moslangan qatorga TEGMAYMIZ.
      if (
        existing &&
        !existing.matched_automatically &&
        existing.elchi_district_id
      ) {
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
  /**
   * TUMANNI QO'LDA MOSLASH.
   *
   * NEGA KERAK BO'LDI (2026-09-11, real testda aniqlandi): avtomatik moslash
   * SOATO bo'yicha ishlaydi, lekin Elchi produksiyasida tumanlarning
   * `sato_code` qiymati HAQIQIY SOATO emas — o'rinbosar satr
   * (`REG-03-DIS-02` ko'rinishida). PCS'da esa haqiqiy kod (`1703224`).
   * Kesishma nol, ya'ni `syncDistricts` 184 tumandan hech birini moslay
   * olmadi.
   *
   * Bu metod o'sha holatdan chiqish yo'li: operator Elchi tumanini qo'lda
   * ko'rsatadi. `matched_automatically = false` qo'yiladi, shuning uchun
   * keyingi avtomatik moslash bu qatorni USTIDAN YOZMAYDI.
   *
   * ⚠️ DARVOZAGA TEGMAYDI. Moslash — texnik amal; jo'natishga ruxsat esa
   * alohida, ataylab qilinadigan qaror (`setDistrictEnabled`).
   */
  async setDistrictMapping(
    districtId: string,
    elchiDistrictId: string,
    elchiRegionId: string | null,
    user?: JwtPayload,
  ): Promise<ElchiDistrictMapEntity> {
    const district = await this.districtRepo.findOne({
      where: { id: districtId },
    });
    if (!district) {
      throw new NotFoundException('Tuman topilmadi');
    }

    const remoteId = String(elchiDistrictId ?? '').trim();
    if (!remoteId) {
      throw new BadRequestException("Elchi tumani ko'rsatilmagan");
    }

    let row = await this.mapRepo.findOne({
      where: { district_id: districtId },
    });
    if (!row) {
      row = this.mapRepo.create({
        district_id: districtId,
        sato_code: district.sato_code ?? null,
        is_enabled: false,
      });
    }

    const before = {
      elchi_district_id: row.elchi_district_id,
      elchi_region_id: row.elchi_region_id,
    };

    row.elchi_district_id = remoteId;
    row.elchi_region_id = String(elchiRegionId ?? '').trim() || null;
    // Qo'lda qo'yilgani BELGILANADI — `syncDistricts` buni saqlab qoladi.
    row.matched_automatically = false;

    const saved = await this.mapRepo.save(row);

    await this.activityLog.log({
      entity_type: 'elchi_district_map',
      entity_id: saved.id,
      action: 'district_mapped_manually',
      old_value: before,
      new_value: {
        elchi_district_id: saved.elchi_district_id,
        elchi_region_id: saved.elchi_region_id,
      },
      description: `${district.name} tumani Elchi tumaniga qo'lda moslandi`,
      user,
    });

    return saved;
  }

  /**
   * ELCHI'DA "BeePost" MARKET AKKAUNTINI OCHISH.
   *
   * ⚠️ TARIF KURYERDAN OLINADI, qo'lda kiritilmaydi. Sabab (M4): PCS'dagi
   * vakil-kuryer tarifi va Elchi'dagi market tarifi TENG bo'lishi shart —
   * aks holda biz bir summani, Elchi boshqasini ushlab qoladi va ikki daftar
   * ajraladi. Ikki joyga qo'lda kiritish esa aynan shu farqni tug'diradi.
   *
   * Shu bois avval kuryer biriktiriladi, keyin market ochiladi.
   *
   * Idempotent: Elchi `external_seller_id` bo'yicha ikkinchi market ochmaydi,
   * mavjudini qaytaradi.
   */
  async provisionMarket(
    user?: JwtPayload,
  ): Promise<{
    elchi_market_id: string;
    tariff_home: number;
    tariff_center: number;
  }> {
    const config = await this.getOrCreate();

    if (!config.api_base_url || !config.api_key) {
      throw new BadRequestException(
        'Avval Elchi manzili va API kalitini kiriting',
      );
    }
    if (!config.elchi_courier_user_id) {
      throw new BadRequestException(
        "Avval vakil-kuryerni biriktiring — market tarifi o'sha kuryerdan olinadi",
      );
    }

    const courier = await this.userRepo.findOne({
      where: { id: config.elchi_courier_user_id },
    });
    if (!courier) {
      throw new NotFoundException('Vakil-kuryer topilmadi');
    }

    const tariffHome = Number(courier.tariff_home ?? 0);
    const tariffCenter = Number(courier.tariff_center ?? 0);
    /**
     * Nol tarif RAD ETILADI. Elchi yuborilmagan tarifni 0 deb oladi va bepul
     * yetkazadi — butun naqd bizning balansga tushadi, Elchi esa hech nima
     * ushlab qolmaydi (M4). Bu jimgina pul xatosi bo'lardi.
     */
    if (tariffHome <= 0 || tariffCenter <= 0) {
      throw new BadRequestException(
        `Vakil-kuryer tarifi nol (uy: ${tariffHome}, markaz: ${tariffCenter}) — ` +
          'avval kuryer tarifini to‘g‘rilang',
      );
    }

    const response = await this.api.provisionMarket({
      // Barqaror kalit: sozlama qatorining o'zi. Takroriy chaqiruv yangi
      // market ochmaydi.
      external_seller_id: config.id,
      name: 'BeePost',
      phone: courier.phone_number,
      tariff_home: tariffHome,
      tariff_center: tariffCenter,
    });

    const marketId = String(response?.elchi_market_id ?? '').trim();
    if (!marketId) {
      throw new BadRequestException(
        `Elchi javobida elchi_market_id yo'q: ${JSON.stringify(response).slice(0, 200)}`,
      );
    }

    config.elchi_market_id = marketId;
    await this.repo.save(config);

    await this.activityLog.log({
      entity_type: 'elchi_config',
      entity_id: config.id,
      action: 'elchi_market_provisioned',
      new_value: {
        elchi_market_id: marketId,
        tariff_home: tariffHome,
        tariff_center: tariffCenter,
      },
      description: "Elchi'da BeePost market akkaunti ochildi",
      user,
    });

    return {
      elchi_market_id: marketId,
      tariff_home: tariffHome,
      tariff_center: tariffCenter,
    };
  }

  /**
   * VILOYATLAR bo'yicha darvoza manzarasi.
   *
   * NEGA KERAK. Tumanlar jadvali faqat MOSLANGAN qatorlarni ko'rsatadi
   * (`elchi_district_map` da moslanmagan tuman uchun qator umuman yo'q).
   * Natijada operator viloyatda nechta tuman "ko'rinmas" qolganini bilmasdi.
   * Darvoza esa "hammasi yoki hech biri": pochtada bitta ruxsatsiz tuman
   * bo'lsa BUTUN pochta bloklanadi. Ya'ni aynan ko'rinmaydigan tumanlar
   * jo'natishni to'sardi va sababi ekranda yo'q edi.
   *
   * Shu bois bu yerda TUMANLAR jadvalidan boshlanadi (moslama emas) — har bir
   * viloyatning to'liq surati chiqadi: jami / moslangan / ochiq.
   */
  async listRegionGate(): Promise<
    Array<{
      region_id: string;
      region_name: string;
      total: number;
      mapped: number;
      enabled: number;
      /** Viloyatning HAMMA tumani ochiq — pochtasini butunligicha jo'natsa bo'ladi. */
      fully_open: boolean;
      /** Moslanmagani bor — ular ochib bo'lmaydi va pochtani to'sadi. */
      unmapped_names: string[];
    }>
  > {
    const rows = await this.districtRepo
      .createQueryBuilder('d')
      .innerJoin('region', 'r', 'r.id = d.region_id')
      .leftJoin(
        'elchi_district_map',
        'm',
        'm.district_id = d.id AND m.elchi_district_id IS NOT NULL',
      )
      .select('r.id', 'region_id')
      .addSelect('r.name', 'region_name')
      .addSelect('COUNT(d.id)', 'total')
      .addSelect('COUNT(m.id)', 'mapped')
      .addSelect('COUNT(m.id) FILTER (WHERE m.is_enabled)', 'enabled')
      .addSelect(
        "COALESCE(ARRAY_AGG(d.name) FILTER (WHERE m.id IS NULL), '{}')",
        'unmapped_names',
      )
      .groupBy('r.id')
      .addGroupBy('r.name')
      .orderBy('r.name', 'ASC')
      .getRawMany<{
        region_id: string;
        region_name: string;
        total: string;
        mapped: string;
        enabled: string;
        unmapped_names: string[];
      }>();

    return rows.map((r) => {
      const total = Number(r.total);
      const enabled = Number(r.enabled);
      return {
        region_id: r.region_id,
        region_name: r.region_name,
        total,
        mapped: Number(r.mapped),
        enabled,
        // ⚠️ `enabled === mapped` YETARLI EMAS: moslanmagan tuman ham
        // pochtani to'sadi. Shuning uchun solishtiruv JAMI bilan.
        fully_open: total > 0 && enabled === total,
        unmapped_names: r.unmapped_names ?? [],
      };
    });
  }

  /**
   * DARVOZA — BUTUN VILOYAT uchun.
   *
   * Elchi BeePost uchun "super kuryer": operator butun viloyat pochtasini
   * jo'nata olishi kerak, tumanlarni bittalab yoqib chiqmasdan.
   *
   * Bu yerda viloyatning O'Z `is_enabled` ustuni ATAYLAB yaratilmadi. Aks
   * holda ikkita haqiqat manbai paydo bo'lardi ("viloyat ochiq, lekin tuman
   * yopiq — qaysi biri kuchli?"). Jo'natish qarori hamisha BUYURTMA TUMANI
   * bo'yicha hal bo'ladi, shuning uchun yagona manba — tuman. Viloyat
   * darajasi esa shu tumanlar ustidan ommaviy amal.
   *
   * Moslanmagan tuman OCHILMAYDI (tumanlik qoida bilan bir xil) — u javobda
   * alohida qaytariladi, chunki operator uni ko'rishi shart: darvoza
   * "hammasi yoki hech biri" bo'lgani uchun bitta moslanmagan tuman butun
   * viloyat pochtasini to'sadi.
   */
  async setRegionEnabled(
    regionId: string,
    enabled: boolean,
    user?: JwtPayload,
  ): Promise<{
    region_id: string;
    region_name: string;
    total: number;
    mapped: number;
    changed: number;
    enabled_after: number;
    unmapped_names: string[];
    fully_open: boolean;
  }> {
    const districts = await this.districtRepo.find({
      where: { region_id: regionId },
      relations: ['region'],
    });
    if (!districts.length) {
      throw new NotFoundException('Viloyat topilmadi yoki tumanlari yo‘q');
    }
    const regionName = districts[0].region?.name ?? regionId;
    const districtIds = districts.map((d) => d.id);

    const maps = await this.mapRepo.find({
      where: { district_id: In(districtIds) },
    });
    const mapped = maps.filter((m) => !!m.elchi_district_id);

    // Faqat HAQIQATAN o'zgaradiganlari yoziladi — activity-log'da "12 ta
    // o'zgardi" deb turib aslida 0 ta o'zgargan bo'lishi chalg'itadi.
    const toChange = mapped.filter((m) => m.is_enabled !== enabled);
    if (toChange.length) {
      await this.mapRepo.update(
        { id: In(toChange.map((m) => m.id)) },
        { is_enabled: enabled },
      );
    }

    const mappedIds = new Set(mapped.map((m) => m.district_id));
    const unmappedNames = districts
      .filter((d) => !mappedIds.has(d.id))
      .map((d) => d.name);

    const enabledAfter = enabled ? mapped.length : 0;

    // Bitta log — har bir tuman uchun alohida emas. 16 ta yozuv jurnalni
    // ko'mib yuboradi va amal aslida BITTA qaror edi.
    await this.activityLog.log({
      entity_type: 'elchi_district_map',
      entity_id: regionId,
      action: 'region_gate_changed',
      old_value: { is_enabled: !enabled },
      new_value: { is_enabled: enabled },
      description: enabled
        ? `${regionName}: ${toChange.length} ta tuman Elchi'ga jo'natishga ruxsat oldi` +
          (unmappedNames.length
            ? ` (${unmappedNames.length} ta moslanmagan tuman ochilmadi)`
            : '')
        : `${regionName}: ${toChange.length} ta tumanda Elchi'ga jo'natish bloklandi`,
      user,
    });

    return {
      region_id: regionId,
      region_name: regionName,
      total: districts.length,
      mapped: mapped.length,
      changed: toChange.length,
      enabled_after: enabledAfter,
      unmapped_names: unmappedNames,
      fully_open: enabled && enabledAfter === districts.length,
    };
  }

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
  ): Promise<{
    elchi_district_id: string;
    elchi_region_id: string | null;
  } | null> {
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
