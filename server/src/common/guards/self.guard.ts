import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../enums';

@Injectable()
export class SelfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // JWT orqali kelgan user
    const paramId = request.params.id;

    console.log(user.id, paramId);

    // Agar admin bo‘lsa, ruxsat beramiz
    if (user?.role === Roles.ADMIN || user?.role === Roles.SUPERADMIN) {
      return true;
    }

    // Agar id o‘zi bo‘lsa, ruxsat beramiz
    if (user?.id === paramId) {
      return true;
    }

    throw new ForbiddenException("You don't have access to this resource");
  }
}
