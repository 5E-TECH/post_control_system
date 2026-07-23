import {
  runWithRequestContext,
  getRequestContext,
  getRequestAuditMeta,
} from './request-context';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('request-context (AsyncLocalStorage)', () => {
  it('async/await va ichki "tranzaksiya" bo\'ylab kontekstni saqlaydi', async () => {
    const result = await runWithRequestContext(
      { ip: '213.230.100.5', user_agent: 'UA-A', device_id: 'dev-A' },
      async () => {
        await sleep(5);
        await Promise.resolve();
        // chuqurdagi "tranzaksiya" ichida log() chaqirilganini simulyatsiya qiladi
        return await (async () => {
          await sleep(3);
          return getRequestAuditMeta();
        })();
      },
    );
    expect(result).toEqual({
      ip: '213.230.100.5',
      user_agent: 'UA-A',
      device_id: 'dev-A',
    });
  });

  it('parallel so\'rovlarni izolyatsiya qiladi (kontekst aralashmaydi)', async () => {
    const run = (store: any) =>
      runWithRequestContext(store, async () => {
        await sleep(5);
        return getRequestAuditMeta();
      });
    const [a, b] = await Promise.all([
      run({ ip: '1.1.1.1', device_id: 'A' }),
      run({ ip: '2.2.2.2', device_id: 'B' }),
    ]);
    expect(a).toEqual({ ip: '1.1.1.1', device_id: 'A' });
    expect(b).toEqual({ ip: '2.2.2.2', device_id: 'B' });
  });

  it('HTTP konteksti tashqarisida (bot/CRON) bo\'sh meta qaytaradi', () => {
    expect(getRequestContext()).toBeUndefined();
    expect(getRequestAuditMeta()).toEqual({});
  });
});
