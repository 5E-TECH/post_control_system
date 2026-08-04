import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityLogService } from 'src/api/activity-log/activity-log.service';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { LOG_INVESTOR_ACTION } from '../decorator/log-investor-access.decorator';

/**
 * Investor surface'iga har bir muvaffaqiyatli o'qish so'rovini activity-log'ga
 * yozadi (kim, qaysi endpoint, qaysi filtrlar). IP/qurilma request-context orqali
 * `metadata` ichiga avtomatik qo'shiladi. Logga yozish best-effort — hech qachon
 * asosiy javobni bloklamaydi (ActivityLogService.log() xatolarni o'zi yutadi).
 */
@Injectable()
export class LogInvestorAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activityLog: ActivityLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const action =
      this.reflector.get<string>(LOG_INVESTOR_ACTION, context.getHandler()) ||
      'unknown';
    const req = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = req?.user;

    return next.handle().pipe(
      tap(() => {
        // Faqat muvaffaqiyatli javobda yozamiz. Fire-and-forget.
        this.activityLog.log({
          entity_type: 'investor_view',
          entity_id: user?.id ?? '00000000-0000-0000-0000-000000000000',
          action: `read:${action}`,
          user: user ?? null,
          description: `Investor ko'rdi: ${action}`,
          metadata: {
            endpoint: req?.originalUrl ?? req?.url,
            method: req?.method,
            query: req?.query ?? {},
          },
        });
      }),
    );
  }
}
