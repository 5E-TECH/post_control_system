import {
  computeCancelMoney,
  computePartlyDeliveredMoney,
  computeSaleMoney,
  resolveBeepostFee,
  reverseMoney,
} from './marketplace-money.util';
import { Where_deliver } from 'src/common/enums';

describe('resolveBeepostFee', () => {
  it('MUZLATILGAN tarifni ustun ko\'radi', () => {
    // ⚠️ Blokerlar B7–B9: tarif qabulda muzlatiladi. Joriy jadvaldan qayta
    // o'qish yo'ldagi posilkalarni tarif o'zgarishida siljitardi.
    const fee = resolveBeepostFee(
      { market_tariff: 50000, where_deliver: Where_deliver.ADDRESS },
      { tariff_center: 99999, tariff_home: 99999 },
    );
    expect(fee).toBe(50000); // 99999 EMAS
  });

  it('muzlatilgan qiymat yo\'q bo\'lsa zaxira tarifdan oladi', () => {
    expect(
      resolveBeepostFee(
        { market_tariff: null, where_deliver: Where_deliver.CENTER },
        { tariff_center: 50000, tariff_home: 70000 },
      ),
    ).toBe(50000);
    expect(
      resolveBeepostFee(
        { market_tariff: null, where_deliver: Where_deliver.ADDRESS },
        { tariff_center: 50000, tariff_home: 70000 },
      ),
    ).toBe(70000);
  });
});

describe('computeSaleMoney', () => {
  it('kontrakt formulasini bajaradi', () => {
    const m = computeSaleMoney({
      collected_from_customer: 200000, beepost_fee: 50000, extra_cost: 5000,
      where_deliver: Where_deliver.CENTER, tariff_version: 3,
    });
    expect(m.net_to_marketplace).toBe(145000);
    expect(m.beepost_fee_basis).toBe('center');
    expect(m.tariff_version).toBe(3);
  });

  it('PREPAID: net MANFIY (nolga qirqmaydi)', () => {
    // ⚠️ Qaror P8. `Math.max(0, ...)` qo'yilsa prepaid yo'li jimgina
    // buzilib, daftar noto'g'ri tomonga ketardi.
    const m = computeSaleMoney({
      collected_from_customer: 0, beepost_fee: 50000, prepaid: true,
      where_deliver: Where_deliver.CENTER,
    });
    expect(m.net_to_marketplace).toBe(-50000);
    expect(m.prepaid).toBe(true);
  });

  it('COD tarifdan kam bo\'lsa ham manfiy', () => {
    expect(
      computeSaleMoney({
        collected_from_customer: 30000, beepost_fee: 50000,
        where_deliver: Where_deliver.CENTER,
      }).net_to_marketplace,
    ).toBe(-20000);
  });

  it('uyga yetkazishda basis `home`', () => {
    expect(
      computeSaleMoney({
        collected_from_customer: 470000, beepost_fee: 70000,
        where_deliver: Where_deliver.ADDRESS,
      }).beepost_fee_basis,
    ).toBe('home');
  });
});

describe('computeCancelMoney', () => {
  it('yetkazish haqqi OLINMAYDI (qaror P4)', () => {
    const m = computeCancelMoney({ where_deliver: Where_deliver.CENTER });
    expect(m.beepost_fee).toBe(0);
    expect(m.net_to_marketplace).toBe(0);
    // ⚠️ `-0` EMAS: JSON'da zararsiz, lekin `Object.is` bilan taqqoslashda
    // kutilmagan natija berardi.
    expect(Object.is(m.net_to_marketplace, -0)).toBe(false);
  });

  it('faqat ortiqcha xarajat yechiladi (qaror P5/P6)', () => {
    const m = computeCancelMoney({ extra_cost: 5000, where_deliver: Where_deliver.CENTER });
    expect(m.beepost_fee).toBe(0);
    expect(m.net_to_marketplace).toBe(-5000);
  });
});

describe('computePartlyDeliveredMoney', () => {
  it('haq TO\'LIQ olinadi, qaytgan qism bepul (qaror O2/P7)', () => {
    const m = computePartlyDeliveredMoney({
      delivered_amount: 120000, returned_amount: 80000,
      beepost_fee: 50000, where_deliver: Where_deliver.CENTER,
    });
    expect(m.beepost_fee).toBe(50000);      // to'liq — yetkazish bajarilgan
    expect(m.net_to_marketplace).toBe(70000); // 120000 - 50000
    expect(m.returned_amount).toBe(80000);
  });
});

describe('reverseMoney', () => {
  it('TESKARI ishora beradi, qayta hisoblamaydi', () => {
    // ⚠️ Bloker B5: `rollbackOrderToWaiting` tariflarni joriy qatordan
    // qayta o'qiydi. Tarif o'zgargandan keyin rollback asl sotuvdan BOSHQA
    // summani qaytarardi va daftar abadiy siljirdi.
    const sale = computeSaleMoney({
      collected_from_customer: 200000, beepost_fee: 50000, extra_cost: 5000,
      where_deliver: Where_deliver.CENTER,
    });
    const back = reverseMoney(sale);

    expect(back.net_to_marketplace).toBe(-145000);
    expect(back.beepost_fee).toBe(-50000);
    expect(back.extra_cost).toBe(-5000);
    // Yig'indi NOLGA teng — daftar siljimaydi.
    expect(sale.net_to_marketplace! + back.net_to_marketplace!).toBe(0);
  });

  it('prepaid manfiy sotuvni ham to\'g\'ri qaytaradi', () => {
    const sale = computeSaleMoney({
      collected_from_customer: 0, beepost_fee: 50000,
      where_deliver: Where_deliver.CENTER,
    });
    const back = reverseMoney(sale);
    expect(back.net_to_marketplace).toBe(50000);
    expect(sale.net_to_marketplace! + back.net_to_marketplace!).toBe(0);
  });
});
