import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorator/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    // FAIL-CLOSED: RolesGuard bilan himoyalangan endpoint majburiy ravishda
    // @AcceptRoles(...) e'lon qilishi shart. Dekorator yo'q yoki bo'sh bo'lsa —
    // hech kimga ruxsat berilmaydi (avvalgi fail-open `return true` xatosi tuzatildi).
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        'Endpointda rol siyosati aniqlanmagan (fail-closed)',
      );
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Forbidden user');
    }
    return true;
  }
}
