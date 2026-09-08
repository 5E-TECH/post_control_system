import { OrderBotUpdate } from './order-bot.update';

/**
 * enqueueAi — per-user KETMA-KET navbat. Kafolatlar: (1) bir foydalanuvchi ishlari
 * kelgan tartibда, parallel EMAS bajariladi (draft ustma-ust yozilmasin); (2) DROP
 * yo'q — cheklovga (MAX_QUEUE) yetmaguncha hammasi qabul qilinadi; (3) to'lsa yangi
 * ish rad etiladi (chaqiruvchi ogohlantiradi); (4) har foydalanuvchi alohida navbat.
 */
type Svc = {
  enqueueAi: (uid: number, task: () => Promise<void>) => boolean;
  aiPending: Map<number, number>;
};

const make = (): Svc => {
  // Konstruktorni chetlab o'tamiz — instance maydonlarni qo'lda beramiz.
  const svc = Object.create(OrderBotUpdate.prototype);
  svc.aiQueues = new Map();
  svc.aiPending = new Map();
  svc.logger = { error: () => {} };
  return svc as Svc;
};

const waitDrain = async (svc: Svc, uid: number) => {
  while ((svc.aiPending.get(uid) ?? 0) > 0) {
    await new Promise((r) => setTimeout(r, 5));
  }
};

describe('OrderBotUpdate.enqueueAi — per-user navbat', () => {
  it('ishlar KETMA-KET (kelgan tartibда) bajariladi, parallel EMAS', async () => {
    const svc = make();
    const order: number[] = [];
    const task = (n: number, delay: number) => async () => {
      await new Promise((r) => setTimeout(r, delay));
      order.push(n);
    };
    // 1-ish UZOQ, 2-ish qisqa: parallel bo'lsa 2 avval tugardi (2,3,1). Navbatда
    // qat'iy 1,2,3.
    expect(svc.enqueueAi(1, task(1, 40))).toBe(true);
    expect(svc.enqueueAi(1, task(2, 5))).toBe(true);
    expect(svc.enqueueAi(1, task(3, 5))).toBe(true);
    await waitDrain(svc, 1);
    expect(order).toEqual([1, 2, 3]);
  });

  it('DROP yo\'q: MAX_QUEUE gacha hammasi qabul, undan keyin rad etiladi', async () => {
    const svc = make();
    const slow = () => new Promise<void>((r) => setTimeout(r, 40));
    const accepted: boolean[] = [];
    for (let i = 0; i < 15; i++) accepted.push(svc.enqueueAi(7, slow));
    // MAX_QUEUE = 12 -> dastlabki 12 qabul, qolgani rad.
    expect(accepted.slice(0, 12).every((x) => x === true)).toBe(true);
    expect(accepted[12]).toBe(false);
    expect(accepted[13]).toBe(false);
    expect(accepted[14]).toBe(false);
    await waitDrain(svc, 7);
  });

  it('har foydalanuvchi navbati ALOHIDA (biri to\'lsa, boshqasi ishlaydi)', async () => {
    const svc = make();
    const slow = () => new Promise<void>((r) => setTimeout(r, 40));
    for (let i = 0; i < 12; i++) svc.enqueueAi(1, slow);
    expect(svc.enqueueAi(1, slow)).toBe(false); // uid 1 to'ldi
    expect(svc.enqueueAi(2, slow)).toBe(true); // uid 2 bo'sh — qabul
    await waitDrain(svc, 1);
    await waitDrain(svc, 2);
  });

  it('ish xato bersa navbat BUZILMAYDI — keyingilari baribir bajariladi', async () => {
    const svc = make();
    const done: number[] = [];
    svc.enqueueAi(3, async () => {
      throw new Error('bir ish yiqildi');
    });
    svc.enqueueAi(3, async () => {
      done.push(2);
    });
    await waitDrain(svc, 3);
    expect(done).toEqual([2]); // 1-ish yiqildi, 2-ish baribir ishladi
  });
});
