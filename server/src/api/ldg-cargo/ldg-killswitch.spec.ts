/// <reference types="jest" />
import { LdgShipmentService } from './ldg-shipment.service';
import { Status } from 'src/common/enums';

/**
 * LDG "kill switch" — integratsiyani o'chirish / vakil-kuryerni bloklash.
 *
 * assertLdgDispatchEnabled() — barcha dispatch yo'llari (pochta jo'natish, admin
 * qo'lda qayta jo'natish, auto-retry) shu yagona to'siqdan o'tadi. Off yoki
 * kuryer bloklangan bo'lsa buyurtma LDG'ga JO'NATILMAYDI.
 */
describe('LdgShipmentService — dispatch kill switch', () => {
  function buildSvc(config: unknown, courier: unknown) {
    const svc: any = Object.create(LdgShipmentService.prototype);
    svc.configRepo = { findOne: jest.fn().mockResolvedValue(config) };
    svc.userRepo = { findOne: jest.fn().mockResolvedValue(courier) };
    return svc;
  }

  it("config yo'q → xato (sozlamalari yo'q)", async () => {
    const svc = buildSvc(null, null);
    await expect(svc.assertLdgDispatchEnabled()).rejects.toThrow(/sozlamalari/);
  });

  it("is_active=false → JO'NATILMAYDI (integratsiya o'chirilgan)", async () => {
    const svc = buildSvc(
      { is_active: false, ldg_courier_user_id: 'c1' },
      { id: 'c1', status: Status.ACTIVE },
    );
    await expect(svc.assertLdgDispatchEnabled()).rejects.toThrow(/o'chirilgan/);
  });

  it("vakil-kuryer BLOKLANGAN (status INACTIVE) → JO'NATILMAYDI", async () => {
    const svc = buildSvc(
      { is_active: true, ldg_courier_user_id: 'c1' },
      { id: 'c1', status: Status.INACTIVE },
    );
    await expect(svc.assertLdgDispatchEnabled()).rejects.toThrow(/bloklangan/);
  });

  it("vakil-kuryer topilmadi (o'chirilgan) → JO'NATILMAYDI", async () => {
    const svc = buildSvc({ is_active: true, ldg_courier_user_id: 'c1' }, null);
    await expect(svc.assertLdgDispatchEnabled()).rejects.toThrow(/bloklangan/);
  });

  it('faol + kuryer active → dispatch RUXSAT (config qaytadi)', async () => {
    const config = { is_active: true, ldg_courier_user_id: 'c1' };
    const svc = buildSvc(config, { id: 'c1', status: Status.ACTIVE });
    await expect(svc.assertLdgDispatchEnabled()).resolves.toBe(config);
  });

  it('kuryer biriktirilmagan, lekin faol → ruxsat (kuryer faqat terminal oqim uchun)', async () => {
    const config = { is_active: true, ldg_courier_user_id: null };
    const svc = buildSvc(config, null);
    await expect(svc.assertLdgDispatchEnabled()).resolves.toBe(config);
    // Kuryer tekshiruvi umuman chaqirilmaydi.
    expect(svc.userRepo.findOne).not.toHaveBeenCalled();
  });
});
