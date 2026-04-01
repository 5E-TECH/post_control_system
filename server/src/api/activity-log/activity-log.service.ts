import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityLogEntity } from 'src/core/entity/activity-log.entity';
import { ActivityLogRepository } from 'src/core/repository/activity-log.repository';
import { DataSource, EntityManager } from 'typeorm';
import { catchError, successRes } from 'src/infrastructure/lib/response';
import { JwtPayload } from 'src/common/utils/types/user.type';

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

      const log = repo.create({
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        action: params.action,
        old_value: params.old_value || undefined,
        new_value: params.new_value || undefined,
        description: params.description || undefined,
        user_id: params.user?.id || undefined,
        user_name: (params.user as any)?.name || undefined,
        user_role: (params.user as any)?.role || params.user?.role || undefined,
        metadata: params.metadata || undefined,
      } as any);
      await repo.save(log);
    } catch (error) {
      // Log yozishda xato bo'lsa asosiy operatsiyani to'xtatmaymiz
      console.error('Activity log write error:', error?.message);
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
    extra?: { description?: string; metadata?: Record<string, any>; manager?: EntityManager },
  ): Promise<void> {
    await this.log({
      entity_type: 'order',
      entity_id: orderId,
      action: 'status_change',
      old_value: { status: oldStatus },
      new_value: { status: newStatus },
      description: extra?.description || `Buyurtma holati: ${oldStatus} → ${newStatus}`,
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

      return successRes({ logs, total, page, limit }, 200, 'Activity logs');
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Umumiy loglar (barcha entity_type) — admin panel uchun
   */
  async getAllLogs(
    filters: {
      entity_type?: string;
      action?: string;
      user_id?: string;
      search?: string;
      fromDate?: string;
      toDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    try {
      const qb = this.logRepo.createQueryBuilder('log')
        .orderBy('log.created_at', 'DESC');

      if (filters.search) {
        qb.andWhere(
          '(log.description ILIKE :search OR log.user_name ILIKE :search OR log.entity_id::text ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }
      if (filters.entity_type) {
        qb.andWhere('log.entity_type = :entity_type', { entity_type: filters.entity_type });
      }
      if (filters.action) {
        qb.andWhere('log.action = :action', { action: filters.action });
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

      return successRes({ logs, total, page, limit }, 200, 'All activity logs');
    } catch (error) {
      return catchError(error);
    }
  }
}
