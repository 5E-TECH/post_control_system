/// <reference types="jest" />
import { OrderService } from './order.service';

/**
 * BOSHQARUV EGASI GUARDI (`assertControlAllowed`).
 *
 * Tashqi provayderga jo'natilgan buyurtma IKKI tizimda ham ko'rinadi. Ikkalasi
 * ham mustaqil "sotildi" yozsa, pul IKKI DAFTARDA paydo bo'ladi: bizning
 * kassada bir marta, provayder balansida bir marta. Bizning status guardimiz
 * (sotish `WAITING` talab qiladi) faqat BIZ tomonni himoyalaydi.
 *
 * Shu bois: bir vaqtda FAQAT BITTA ega.
 */
function buildSvc(controlOwner: string | null | undefined) {
  const svc: any = Object.create(OrderService.prototype);
  svc.orderRepo = {
    findOne: jest.fn().mockResolvedValue(
      controlOwner === undefined
        ? null
        : { id: 'o-1', control_owner: controlOwner },
    ),
  };
  return svc;
}

describe('OrderService — assertControlAllowed', () => {
  it("control_owner bo'sh -> amal RUXSAT (odatdagi holat)", async () => {
    const svc = buildSvc(null);
    await expect(
      svc.assertControlAllowed('o-1', 'sotish'),
    ).resolves.toBeUndefined();
  });

  it('tashqi tizim nazoratida -> amal BLOKLANADI', async () => {
    const svc = buildSvc('elchi');
    await expect(svc.assertControlAllowed('o-1', 'sotish')).rejects.toThrow(
      /elchi/,
    );
  });

  it('xato xabari HARAKATGA CHORLAYDI (nima qilish kerakligini aytadi)', async () => {
    const svc = buildSvc('elchi');
    const err = await svc.assertControlAllowed('o-1', 'sotish').catch((e: any) => e);
    // Operator "nega bo'lmadi" deb qolmasligi kerak.
    expect(String(err.message)).toMatch(/boshqaruvni qaytarib olish/i);
    expect(String(err.message)).toMatch(/sotish/);
  });

  // Webhook oqimi — provayder holatni o'zgartirganda guard o'tkazishi SHART,
  // aks holda tashqi tizim natijasi bizga hech qachon yozilmaydi.
  it('bypassControlGuard -> ichki webhook oqimi o‘tadi', async () => {
    const svc = buildSvc('elchi');
    await expect(
      svc.assertControlAllowed('o-1', 'sotish', {
        bypassControlGuard: true,
      }),
    ).resolves.toBeUndefined();
    // Bypass bo'lsa DB ham o'qilmaydi (ortiqcha so'rov yo'q).
    expect(svc.orderRepo.findOne).not.toHaveBeenCalled();
  });

  it("buyurtma topilmasa guard to'smaydi (chaqiruvchining o'z tekshiruvi bor)", async () => {
    const svc = buildSvc(undefined);
    await expect(
      svc.assertControlAllowed('yo-q', 'sotish'),
    ).resolves.toBeUndefined();
  });

  it("bo'sh satr control_owner -> ruxsat (null bilan bir xil)", async () => {
    const svc = buildSvc('   ');
    await expect(
      svc.assertControlAllowed('o-1', 'bekor qilish'),
    ).resolves.toBeUndefined();
  });
});
