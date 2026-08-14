import 'reflect-metadata';
import { ROLES_KEY } from 'src/common/decorator/roles.decorator';
import { Roles } from 'src/common/enums';
import { InvestorAdminController } from './investor-admin.controller';

// @AcceptRoles metadatasini bevosita tekshiradi — ega qaroridagi RBAC ajratimi
// buzilmasligini qulflaydi (DI shart emas).
const rolesOf = (method: string): string[] | undefined =>
  Reflect.getMetadata(ROLES_KEY, (InvestorAdminController.prototype as any)[method]);

describe('InvestorAdminController RBAC (ega qarori)', () => {
  it('kapital / ulush / kapital-qaytarish — FAQAT SUPERADMIN', () => {
    expect(rolesOf('capital')).toEqual([Roles.SUPERADMIN]);
    expect(rolesOf('ownership')).toEqual([Roles.SUPERADMIN]);
    expect(rolesOf('capitalWithdrawal')).toEqual([Roles.SUPERADMIN]);
  });

  it('foyda taqsimoti (dividend) — SUPERADMIN + ADMIN', () => {
    expect(rolesOf('distribution')).toEqual([Roles.SUPERADMIN, Roles.ADMIN]);
  });
});
