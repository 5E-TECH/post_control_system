import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Roles } from '../enums';

// Soxta ExecutionContext — faqat guard ishlatadigan qismlarни beradi.
const makeCtx = (user: any) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as any;

// requiredRoles — reflector.getAllAndOverride qaytaradigan qiymat (@AcceptRoles metadatasi).
const makeGuard = (requiredRoles: unknown) => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
};

describe('RolesGuard (fail-closed)', () => {
  it("@AcceptRoles yo'q (undefined metadata) — Forbidden (fail-closed)", () => {
    const guard = makeGuard(undefined);
    expect(() => guard.canActivate(makeCtx({ role: Roles.ADMIN }))).toThrow(
      ForbiddenException,
    );
  });

  it("@AcceptRoles() bo'sh massiv bilan — Forbidden (fail-closed)", () => {
    const guard = makeGuard([]);
    expect(() =>
      guard.canActivate(makeCtx({ role: Roles.SUPERADMIN })),
    ).toThrow(ForbiddenException);
  });

  it("rol ruxsat ro'yxatida yo'q — Forbidden", () => {
    const guard = makeGuard([Roles.ADMIN, Roles.SUPERADMIN]);
    expect(() => guard.canActivate(makeCtx({ role: Roles.COURIER }))).toThrow(
      ForbiddenException,
    );
  });

  it('user umuman yo\'q (JWT req.user o\'rnatmagan) — Forbidden', () => {
    const guard = makeGuard([Roles.ADMIN]);
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('user bor lekin role maydoni yo\'q — Forbidden', () => {
    const guard = makeGuard([Roles.ADMIN]);
    expect(() => guard.canActivate(makeCtx({}))).toThrow(ForbiddenException);
  });

  it("rol ruxsat ro'yxatida bor — true", () => {
    const guard = makeGuard([Roles.ADMIN, Roles.SUPERADMIN]);
    expect(guard.canActivate(makeCtx({ role: Roles.ADMIN }))).toBe(true);
  });

  it('INVESTOR roli ruxsat ro\'yxatida bo\'lsa ruxsat beriladi', () => {
    const guard = makeGuard([Roles.INVESTOR]);
    expect(guard.canActivate(makeCtx({ role: Roles.INVESTOR }))).toBe(true);
  });
});
