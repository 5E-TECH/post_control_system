import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityLogEntity } from 'src/core/entity/activity-log.entity';
import { ActivityLogRepository } from 'src/core/repository/activity-log.repository';
import { DataSource, EntityManager } from 'typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { orderStatusUz } from 'src/common/utils/status-label.util';

export interface LogParams {
  entity_type: string;
  entity_id: string;
  action: string;
  old_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  description?: string;
  user?: JwtPayload | { id: string; name?: string; role?: string } | null;
  metadata?: Record<string, any>;
  manager?: EntityManager; // transaction ichida yozish uchun
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly logRepo: ActivityLogRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Log yozish — transaction ichida ham, tashqarisida ham ishlaydi.
   * Xatolik bo'lsa jimgina o'tkazib yuboradi (asosiy operatsiyani to'xtatmaydi).
   */
  async log(params: LogParams): Promise<void> {
    try {
      const repo = params.manager
        ? params.manager.getRepository(ActivityLogEntity)
        : this.logRepo;

      // JWT'da `name` saqlanmaydi — agar payloadga aniq berilmagan bo'lsa,
      // user_id bo'yicha DB'dan ismni olib qo'yamiz. Shu orqali kelajakda
      // har enrichLogs chaqirishda qayta query kerak emas.
      let resolvedName = (params.user as any)?.name;
      let resolvedRole =
        (params.user as any)?.role || params.user?.role || undefined;
      const userId = params.user?.id || undefined;

      if (userId && (!resolvedName || !resolvedRole)) {
        try {
          const queryRunner = params.manager
            ? params.manager.queryRunner
            : null;
          const rows = queryRunner
            ? await queryRunner.query(
                `SELECT name, role FROM users WHERE id = $1 LIMIT 1`,
                [userId],
              )
            : await this.dataSource.query(
                `SELECT name, role FROM users WHERE id = $1 LIMIT 1`,
                [userId],
              );
          if (rows?.[0]) {
            resolvedName = resolvedName || rows[0].name;
            resolvedRole = resolvedRole || rows[0].role;
          }
        } catch (lookupErr) {
          // user lookup xatosi log yozilishini to'xtatmasin
          console.error(
            'Activity log user lookup error:',
            (lookupErr as any)?.message,
          );
        }
      }

      const log = repo.create({
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        action: params.action,
        old_value: params.old_value || undefined,
        new_value: params.new_value || undefined,
        description: params.description || undefined,
        user_id: userId,
        user_name: resolvedName || undefined,
        user_role: resolvedRole,
        metadata: params.metadata || undefined,
      } as any);
      await repo.save(log);
    } catch (error) {
      // Log yozishda xato bo'lsa asosiy operatsiyani to'xtatmaymiz
      const message = error instanceof Error ? error.message : String(error);
      console.error('Activity log write error:', message);
    }
  }

  /**
   * Buyurtma status o'zgarishini loglash uchun qisqa metod
   */
  async logOrderStatusChange(
    orderId: string,
    oldStatus: string,
    newStatus: string,
    user: JwtPayload | null,
    extra?: {
      description?: string;
      metadata?: Record<string, any>;
      manager?: EntityManager;
    },
  ): Promise<void> {
    await this.log({
      entity_type: 'order',
      entity_id: orderId,
      action: 'status_change',
      old_value: { status: oldStatus },
      new_value: { status: newStatus },
      description:
        extra?.description ||
        `Buyurtma holati: ${orderStatusUz(oldStatus)} → ${orderStatusUz(newStatus)}`,
      user,
      metadata: extra?.metadata,
      manager: extra?.manager,
    });
  }

  /**
   * Resurs uchun barcha loglarni olish (order, post, user, etc.)
   */
  async getLogsByEntity(
    entityType: string,
    entityId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    try {
      const [logs, total] = await this.logRepo.findAndCount({
        where: { entity_type: entityType, entity_id: entityId },
        order: { created_at: 'DESC' },
        take: limit,
        skip: (page - 1) * limit,
      });

      const enriched = await this.enrichLogs(logs);
      return successRes(
        { logs: enriched, total, page, limit },
        200,
        'Activity logs',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Loglarga bog'liq entity'lar xulosasini qo'shib beradi — UIda inson ko'rishi uchun.
   * Masalan, order log'iga customer ismi, market nomi, telefon raqam qo'shiladi.
   * Bir martalik batch query bilan qilinadi — N+1 bo'lmasligi uchun.
   */
  private async enrichLogs(logs: ActivityLogEntity[]): Promise<any[]> {
    if (logs.length === 0) return logs;

    const orderIds: string[] = [];
    const postIds: string[] = [];
    const entityUserIds: string[] = [];
    const cashboxIds: string[] = [];
    // Nomli config/katalog entity'lari — entity_summary'da nom ko'rsatish uchun.
    const regionEntityIds: string[] = [];
    const districtEntityIds: string[] = [];
    const productEntityIds: string[] = [];
    const integrationEntityIds: string[] = [];
    // Log mualliflari (user_id) — JWT'da `name` saqlanmaydi, shuning uchun
    // log yozilayotganda user_name bo'sh qoladi. Bu yerda DB'dan to'ldiramiz.
    const actorIds: string[] = [];

    // old_value/new_value ichidagi FK UUID'lari — diff ko'rinishida xom UUID
    // emas, ismni ko'rsatish uchun ularni ham yig'amiz (Item 13b).
    const fkUserIds = new Set<string>();
    const fkDistrictIds = new Set<string>();
    const fkRegionIds = new Set<string>();
    const USER_FK_KEYS = [
      'customer_id',
      'courier_id',
      'market_id',
      'operator_id',
      'staff_id',
    ];

    for (const log of logs) {
      if (log.entity_type === 'order') orderIds.push(log.entity_id);
      else if (log.entity_type === 'post') postIds.push(log.entity_id);
      else if (log.entity_type === 'user') entityUserIds.push(log.entity_id);
      else if (log.entity_type === 'cashbox') cashboxIds.push(log.entity_id);
      else if (log.entity_type === 'region')
        regionEntityIds.push(log.entity_id);
      else if (log.entity_type === 'district')
        districtEntityIds.push(log.entity_id);
      else if (log.entity_type === 'product')
        productEntityIds.push(log.entity_id);
      else if (log.entity_type === 'integration')
        integrationEntityIds.push(log.entity_id);

      if (log.user_id) actorIds.push(log.user_id);

      for (const obj of [log.old_value, log.new_value]) {
        if (!obj || typeof obj !== 'object') continue;
        for (const k of USER_FK_KEYS) {
          if (obj[k]) fkUserIds.add(obj[k]);
        }
        if (obj.district_id) fkDistrictIds.add(obj.district_id);
        if (obj.region_id) fkRegionIds.add(obj.region_id);
      }
    }

    // unique
    const uniqueActorIds = Array.from(new Set(actorIds));

    const [orders, posts, entityUsers, cashboxes, actors] = await Promise.all([
      orderIds.length
        ? this.dataSource.query(
            `SELECT o.id, o.order_number, o.total_price, o.status,
                    o.customer_id, o.user_id AS market_id,
                    c.name AS customer_name, c.phone_number AS customer_phone,
                    m.name AS market_name,
                    d.name AS district_name, r.name AS region_name,
                    ls.tracking_number AS ldg_tracking, ls.ldg_status AS ldg_status
             FROM "order" o
             LEFT JOIN users c ON c.id = o.customer_id
             LEFT JOIN users m ON m.id = o.user_id
             LEFT JOIN district d ON d.id = o.district_id
             LEFT JOIN region r ON r.id = d.region_id
             LEFT JOIN ldg_shipment ls ON ls.order_id = o.id
             WHERE o.id = ANY($1)`,
            [orderIds],
          )
        : Promise.resolve([]),
      postIds.length
        ? this.dataSource.query(
            `SELECT p.id, p.qr_code_token, p.status, p.order_quantity, p.post_total_price,
                    p.courier_id, p.region_id, p.created_at AS post_date,
                    cu.name AS courier_name, r.name AS region_name
             FROM post p
             LEFT JOIN users cu ON cu.id = p.courier_id
             LEFT JOIN region r ON r.id = p.region_id
             WHERE p.id = ANY($1)`,
            [postIds],
          )
        : Promise.resolve([]),
      entityUserIds.length
        ? this.dataSource.query(
            `SELECT id, name, phone_number, role FROM users WHERE id = ANY($1)`,
            [entityUserIds],
          )
        : Promise.resolve([]),
      cashboxIds.length
        ? this.dataSource.query(
            `SELECT cb.id, cb.cashbox_type, cb.user_id, u.name AS owner_name, u.role AS owner_role
             FROM cash_box cb
             LEFT JOIN users u ON u.id = cb.user_id
             WHERE cb.id = ANY($1)`,
            [cashboxIds],
          )
        : Promise.resolve([]),
      uniqueActorIds.length
        ? this.dataSource.query(
            `SELECT id, name, phone_number, role FROM users WHERE id = ANY($1)`,
            [uniqueActorIds],
          )
        : Promise.resolve([]),
    ]);

    const orderMap = new Map<string, any>(orders.map((o: any) => [o.id, o]));
    const postMap = new Map<string, any>(posts.map((p: any) => [p.id, p]));
    const entityUserMap = new Map<string, any>(
      entityUsers.map((u: any) => [u.id, u]),
    );
    const cashboxMap = new Map<string, any>(
      cashboxes.map((c: any) => [c.id, c]),
    );
    const actorMap = new Map<string, any>(actors.map((a: any) => [a.id, a]));

    // FK UUID -> nom (diff ko'rinishi uchun) — batch query, N+1 yo'q.
    const [
      fkUsers,
      fkDistricts,
      fkRegions,
      regionEntities,
      districtEntities,
      productEntities,
      integrationEntities,
    ] = await Promise.all([
      fkUserIds.size
        ? this.dataSource.query(
            `SELECT id, name FROM users WHERE id = ANY($1)`,
            [Array.from(fkUserIds)],
          )
        : Promise.resolve([]),
      fkDistrictIds.size
        ? this.dataSource.query(
            `SELECT id, name FROM district WHERE id = ANY($1)`,
            [Array.from(fkDistrictIds)],
          )
        : Promise.resolve([]),
      fkRegionIds.size
        ? this.dataSource.query(
            `SELECT id, name FROM region WHERE id = ANY($1)`,
            [Array.from(fkRegionIds)],
          )
        : Promise.resolve([]),
      // Nomli config/katalog entity'lari (entity_type bo'yicha)
      regionEntityIds.length
        ? this.dataSource.query(
            `SELECT id, name FROM region WHERE id = ANY($1)`,
            [regionEntityIds],
          )
        : Promise.resolve([]),
      districtEntityIds.length
        ? this.dataSource.query(
            `SELECT id, name FROM district WHERE id = ANY($1)`,
            [districtEntityIds],
          )
        : Promise.resolve([]),
      productEntityIds.length
        ? this.dataSource.query(
            `SELECT id, name FROM product WHERE id = ANY($1)`,
            [productEntityIds],
          )
        : Promise.resolve([]),
      integrationEntityIds.length
        ? this.dataSource.query(
            `SELECT id, name FROM external_integration WHERE id = ANY($1)`,
            [integrationEntityIds],
          )
        : Promise.resolve([]),
    ]);
    const fkUserMap = new Map<string, string>(
      fkUsers.map((u: any) => [u.id, u.name]),
    );
    const fkDistrictMap = new Map<string, string>(
      fkDistricts.map((d: any) => [d.id, d.name]),
    );
    const fkRegionMap = new Map<string, string>(
      fkRegions.map((r: any) => [r.id, r.name]),
    );
    // entity_type'i nomli config/katalog bo'lgan loglar uchun nom xaritalari
    const namedEntityMap = new Map<string, any>();
    for (const row of [
      ...regionEntities,
      ...districtEntities,
      ...productEntities,
      ...integrationEntities,
    ]) {
      namedEntityMap.set(row.id, { name: row.name });
    }

    // value obyektidagi *_id maydonlari yoniga ism qo'shadi (mavjud bo'lmasa).
    const resolveNames = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      const out = { ...obj };
      const addName = (
        idKey: string,
        nameKey: string,
        map: Map<string, string>,
      ) => {
        if (out[idKey] && out[nameKey] == null && map.has(out[idKey])) {
          out[nameKey] = map.get(out[idKey]);
        }
      };
      addName('customer_id', 'customer_name', fkUserMap);
      addName('courier_id', 'courier_name', fkUserMap);
      addName('market_id', 'market_name', fkUserMap);
      addName('operator_id', 'operator_name', fkUserMap);
      addName('staff_id', 'staff_name', fkUserMap);
      addName('district_id', 'district_name', fkDistrictMap);
      addName('region_id', 'region_name', fkRegionMap);
      return out;
    };

    return logs.map((log) => {
      let entity_summary: any = null;
      if (log.entity_type === 'order') {
        entity_summary = orderMap.get(log.entity_id) || null;
      } else if (log.entity_type === 'post') {
        entity_summary = postMap.get(log.entity_id) || null;
      } else if (log.entity_type === 'user') {
        entity_summary = entityUserMap.get(log.entity_id) || null;
      } else if (log.entity_type === 'cashbox') {
        entity_summary = cashboxMap.get(log.entity_id) || null;
      } else if (
        log.entity_type === 'region' ||
        log.entity_type === 'district' ||
        log.entity_type === 'product' ||
        log.entity_type === 'integration'
      ) {
        entity_summary = namedEntityMap.get(log.entity_id) || null;
      }

      // Actor (kim qilgan) ma'lumotlarini DB'dan to'ldirib qaytaramiz —
      // JWT'da `name` yo'q, shuning uchun log yozilayotganda saqlanmaydi.
      const actor = log.user_id ? actorMap.get(log.user_id) : null;
      return {
        ...log,
        // user_name bo'sh bo'lsa DB'dan oling (eski loglar uchun ham)
        user_name: log.user_name || actor?.name || null,
        user_role: log.user_role || actor?.role || null,
        user_phone: actor?.phone_number || null,
        // old_value/new_value ichidagi FK ID'lar yoniga ism qo'shilgan nusxa
        old_value: resolveNames(log.old_value),
        new_value: resolveNames(log.new_value),
        entity_summary,
      };
    });
  }

  /**
   * Umumiy loglar (barcha entity_type) — admin panel uchun
   */
  async getAllLogs(filters: {
    entity_type?: string;
    action?: string;
    excludeAction?: string;
    user_id?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const qb = this.logRepo
        .createQueryBuilder('log')
        .orderBy('log.created_at', 'DESC');

      if (filters.search) {
        // "#100042" yoki "100042" kabi buyurtma raqami bo'yicha ham qidiramiz —
        // order_number log'da saqlanmaydi, shuning uchun order jadvalidan ID topamiz.
        const orderNum = filters.search.replace(/[^0-9]/g, '');
        const conds = [
          'log.description ILIKE :search',
          'log.user_name ILIKE :search',
          'log.entity_id::text ILIKE :search',
        ];
        const searchParams: Record<string, any> = {
          search: `%${filters.search}%`,
        };
        if (orderNum) {
          conds.push(
            `log.entity_id IN (SELECT o.id FROM "order" o WHERE o.order_number = :orderNum)`,
          );
          searchParams.orderNum = Number(orderNum);
        }
        qb.andWhere(`(${conds.join(' OR ')})`, searchParams);
      }
      if (filters.entity_type) {
        qb.andWhere('log.entity_type = :entity_type', {
          entity_type: filters.entity_type,
        });
      }
      if (filters.action) {
        qb.andWhere('log.action = :action', { action: filters.action });
      }
      if (filters.excludeAction) {
        qb.andWhere('log.action != :excludeAction', {
          excludeAction: filters.excludeAction,
        });
      }
      if (filters.user_id) {
        qb.andWhere('log.user_id = :user_id', { user_id: filters.user_id });
      }
      if (filters.fromDate) {
        const start = new Date(filters.fromDate);
        start.setHours(0, 0, 0, 0);
        qb.andWhere('log.created_at >= :from', { from: start.getTime() });
      }
      if (filters.toDate) {
        const end = new Date(filters.toDate);
        end.setHours(23, 59, 59, 999);
        qb.andWhere('log.created_at <= :to', { to: end.getTime() });
      }

      const page = filters.page || 1;
      const limit = filters.limit || 50;
      qb.skip((page - 1) * limit).take(limit);

      const [logs, total] = await qb.getManyAndCount();
      const enriched = await this.enrichLogs(logs);

      return successRes(
        { logs: enriched, total, page, limit },
        200,
        'All activity logs',
      );
    } catch (error) {
      return catchError(error);
    }
  }
}
