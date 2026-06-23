import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LdgConfigEntity } from 'src/core/entity/ldg-config.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { Cashbox_type, Roles, Status } from 'src/common/enums';
import { UpdateLdgConfigDto } from './dto/ldg-config.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtPayload } from 'src/common/utils/types/user.type';

// LDG config'da HECH QACHON loglanmaydigan maxfiy maydonlar
const LDG_CONFIG_SECRET_FIELDS = new Set([
  'api_key',
  'webhook_secret',
  'webhook_secret_previous',
  'sender_phone',
]);

@Injectable()
export class LdgConfigService {
  private readonly logger = new Logger(LdgConfigService.name);

  constructor(
    @InjectRepository(LdgConfigEntity)
    private readonly repo: Repository<LdgConfigEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Singleton qatorni topib qaytaradi. Mavjud bo'lmasa yaratadi (default values).
   */
  async getOrCreate(): Promise<LdgConfigEntity> {
    let config = await this.repo.findOne({
      where: {},
      relations: ['ldgCourier'],
      order: { created_at: 'ASC' },
    });
    if (!config) {
      config = this.repo.create({});
      await this.repo.save(config);
    }
    return config;
  }

  /**
   * Sozlamalarni yangilash. Faqat aniq berilgan maydonlar yangilanadi
   * (nullable maydonlar uchun bo'sh qator yuborilsa, null ga o'rnatiladi).
   */
  async update(
    dto: UpdateLdgConfigDto,
    user?: JwtPayload,
  ): Promise<LdgConfigEntity> {
    const config = await this.getOrCreate();

    // Audit uchun farqni yig'amiz — maxfiy maydonlar XOM emas, faqat "o'zgardi" flagi.
    const oldNonSecret: Record<string, any> = {};
    const newNonSecret: Record<string, any> = {};
    const maskedFields: string[] = [];
    for (const key of Object.keys(dto)) {
      const value = (dto as any)[key];
      if (value === undefined) continue;
      if (LDG_CONFIG_SECRET_FIELDS.has(key)) {
        maskedFields.push(key);
        continue;
      }
      oldNonSecret[key] = (config as any)[key];
      newNonSecret[key] = value;
    }

    Object.assign(config, dto);
    const saved = await this.repo.save(config);

    this.activityLog.log({
      entity_type: 'ldg_config',
      entity_id: config.id,
      action: 'config_changed',
      old_value: oldNonSecret,
      new_value: {
        ...newNonSecret,
        ...(maskedFields.length ? { masked_fields: maskedFields } : {}),
      },
      description: `LDG sozlamasi o'zgartirildi${
        maskedFields.length ? ` (maxfiy: ${maskedFields.join(', ')})` : ''
      }`,
      user,
    });
    return saved;
  }

  /**
   * MAVJUD kuryerni LDG vakil-user qilib biriktirish (asosiy yo'l).
   *
   * Tanlangan user'ga:
   *   - `external_provider = 'ldg'` belgilanadi
   *   - `ldg_config.ldg_courier_user_id` ga ID yoziladi
   *   - Agar kassasi yo'q bo'lsa — yangi `FOR_COURIER` kassa yaratiladi
   *
   * User'ning role'i COURIER bo'lishi shart. Aks holda 400 qaytariladi.
   * Boshqa user'larda `external_provider = 'ldg'` bo'lsa — konflikt (400):
   * bir vaqtning o'zida faqat bitta LDG vakil bo'lishi kerak.
   */
  async bindCourier(
    userId: string,
    user?: JwtPayload,
  ): Promise<{
    user_id: string;
    bound: boolean;
  }> {
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
          'Faqat kuryer (role=courier) LDG vakil bo\'la oladi',
        );
      }

      // Boshqa user allaqachon LDG vakil bo'lsa — uni avtomatik bo'shatamiz
      // (chunki bir vaqtda faqat bitta vakil bo'lishi kerak)
      const previous = await queryRunner.manager.findOne(UserEntity, {
        where: { external_provider: 'ldg' },
      });
      if (previous && previous.id !== target.id) {
        previous.external_provider = null;
        await queryRunner.manager.save(previous);
        this.logger.log(
          `Eski LDG vakil bo'shatildi: ${previous.id} (${previous.name})`,
        );
      }

      // Asosiy bog'lash — LDG vakili super kuryer: barcha viloyatlarga xizmat qiladi
      target.external_provider = 'ldg';
      target.is_super_courier = true;
      target.serves_all_regions = true;
      await queryRunner.manager.save(target);

      // Kassasi yo'q bo'lsa yaratamiz
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

      // ldg_config'ga ulash
      let config = await queryRunner.manager.findOne(LdgConfigEntity, {
        where: {},
        order: { created_at: 'ASC' },
      });
      if (!config) {
        config = queryRunner.manager.create(LdgConfigEntity, {});
      }
      config.ldg_courier_user_id = target.id;
      await queryRunner.manager.save(config);

      await queryRunner.commitTransaction();
      this.logger.log(`LDG kuryer biriktirildi: ${target.id} (${target.name})`);
      this.activityLog.log({
        entity_type: 'ldg_config',
        entity_id: config.id,
        action: 'courier_bound',
        new_value: {
          ldg_courier_user_id: target.id,
          courier_name: target.name,
        },
        description: `LDG vakil kuryer biriktirildi: ${target.name}${
          previous && previous.id !== target.id
            ? ` (eski vakil ${previous.name} bo'shatildi)`
            : ''
        }`,
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

  /**
   * YANGI virtual kuryer-user yaratib, darhol LDG vakil qilib belgilash.
   * Foydalanuvchi forma orqali to'liq ma'lumot beradi (ism, telefon, tariflar,
   * region). Default qiymatlar yo'q — barcha majburiy maydonlar to'liq kelishi shart.
   */
  async createCourier(
    args: {
      name: string;
      phone_number: string;
      tariff_home: number;
      tariff_center: number;
      region_id?: string;
    },
    user?: JwtPayload,
  ): Promise<{ user_id: string; created: true }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Telefon raqami unique bo'lishi shart (mavjud user bilan to'qnashmasin)
      const existing = await queryRunner.manager.findOne(UserEntity, {
        where: { phone_number: args.phone_number },
      });
      if (existing) {
        throw new ConflictException(
          `${args.phone_number} telefon raqami bilan foydalanuvchi allaqachon mavjud`,
        );
      }

      // Boshqa LDG vakilini bo'shatamiz (faqat bittasi bo'lishi kerak)
      const previous = await queryRunner.manager.findOne(UserEntity, {
        where: { external_provider: 'ldg' },
      });
      if (previous) {
        previous.external_provider = null;
        await queryRunner.manager.save(previous);
      }

      const userPartial: Partial<UserEntity> = {
        name: args.name,
        phone_number: args.phone_number,
        role: Roles.COURIER,
        status: Status.ACTIVE,
        external_provider: 'ldg',
        // LDG vakili super kuryer: istalgan viloyat buyurtmasini ola oladi
        is_super_courier: true,
        serves_all_regions: true,
        tariff_home: args.tariff_home,
        tariff_center: args.tariff_center,
      };
      if (args.region_id) userPartial.region_id = args.region_id;
      const newUser = queryRunner.manager.create(UserEntity, userPartial);
      await queryRunner.manager.save(newUser);

      const cashbox = queryRunner.manager.create(CashEntity, {
        cashbox_type: Cashbox_type.FOR_COURIER,
        user_id: newUser.id,
      });
      await queryRunner.manager.save(cashbox);

      let config = await queryRunner.manager.findOne(LdgConfigEntity, {
        where: {},
        order: { created_at: 'ASC' },
      });
      if (!config) {
        config = queryRunner.manager.create(LdgConfigEntity, {});
      }
      config.ldg_courier_user_id = newUser.id;
      await queryRunner.manager.save(config);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Yangi LDG vakil-kuryer yaratildi: ${newUser.id} (${newUser.name})`,
      );
      this.activityLog.log({
        entity_type: 'ldg_config',
        entity_id: config.id,
        action: 'courier_bound',
        new_value: {
          ldg_courier_user_id: newUser.id,
          courier_name: newUser.name,
        },
        description: `Yangi LDG vakil-kuryer yaratildi: ${newUser.name} (${args.phone_number})`,
        user,
      });
      return { user_id: newUser.id, created: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Faqat o'qish uchun — sezgir maydonlar (api_key, secretlar) qaytarilmaydi,
   * faqat ular sozlanganmi yo'qmi flagi qaytariladi.
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
}
