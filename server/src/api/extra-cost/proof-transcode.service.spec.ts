/// <reference types="jest" />
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import {
  ProofTranscodeService,
  TRANSCODE,
} from './proof-transcode.service';
import {
  PROOF_VIDEO_BOX_PX,
  PROOF_VIDEO_CRF,
  ensureProofSubdir,
  resolveProofPath,
} from './proof-storage.const';

/**
 * VIDEO SIQISH.
 *
 * Bu servis pulga tegmaydi, lekin uch narsa noto'g'ri bo'lsa oqibati og'ir:
 *
 *   DALIL YO'QOLISHI — isbot pul nizosining yagona hujjati. Siqish
 *                      yiqilsa ham ASL FAYL joyida qolishi SHART.
 *   SERVER YUKI      — ffmpeg protsessorni to'liq egallaydi; bir vaqtda
 *                      bittadan ko'p ishlamasligi kerak.
 *   BUYRUQ IN'EKTSIYASI — argumentlar shell orqali O'TMASLIGI kerak.
 */

const rows = new Map<string, ExtraCostProofEntity>();

const repo = {
  findOne: jest.fn(({ where }: any) =>
    Promise.resolve(rows.get(where.id) ?? null),
  ),
  /**
   * ⚠️ SHARTLI UPDATE — atomik da'voni taqlid qiladi.
   *
   * `where` da `transcode_status` bo'lsa, u MOS KELGANDAGINA yoziladi va
   * `affected: 1` qaytadi. Busiz test poyga holatini umuman ko'rsata
   * olmasdi (soxta repo har doim muvaffaqiyat qaytarardi).
   */
  update: jest.fn((where: any, set: any) => {
    const row = rows.get(where.id);
    if (!row) return Promise.resolve({ affected: 0 });
    if (
      where.transcode_status !== undefined &&
      row.transcode_status !== where.transcode_status
    ) {
      return Promise.resolve({ affected: 0 });
    }
    Object.assign(row, set);
    return Promise.resolve({ affected: 1 });
  }),
} as unknown as Repository<ExtraCostProofEntity>;

const svc = () => new ProofTranscodeService(repo);

/** Diskda haqiqiy fayl yaratadi (siqish diskda ishlaydi). */
const makeProof = (
  over: Partial<ExtraCostProofEntity> = {},
  bytes = 1024,
): ExtraCostProofEntity => {
  const rel = ensureProofSubdir(new Date());
  const storedName = `${randomUUID()}.mp4`;
  const abs = resolveProofPath(rel, storedName);
  fs.writeFileSync(abs, Buffer.alloc(bytes, 7));
  cleanup.push(abs);

  const row = {
    id: randomUUID(),
    rel_path: rel,
    stored_name: storedName,
    mime: 'video/mp4',
    size_bytes: bytes,
    transcode_status: TRANSCODE.PENDING,
    original_size_bytes: null,
    ...over,
  } as ExtraCostProofEntity;
  rows.set(row.id, row);
  return row;
};

const cleanup: string[] = [];

afterEach(() => {
  rows.clear();
  jest.clearAllMocks();
});

afterAll(() => {
  for (const p of cleanup) fs.rmSync(p, { force: true });
});

describe('ffmpeg argumentlari', () => {
  const args = () =>
    svc().buildArgs('/tmp/manba.mov', '/tmp/natija.mp4');

  it('TR1: buyruq MASSIV sifatida beriladi (shell in’ektsiyasi yo‘q)', () => {
    // Satr bo'lib shell orqali o'tsa, fayl nomidagi `;` yoki `$()` server
    // buyrug'iga aylanardi.
    const a = args();
    expect(Array.isArray(a)).toBe(true);
    expect(a).toContain('/tmp/manba.mov');
    expect(a[a.length - 1]).toBe('/tmp/natija.mp4');
  });

  it('TR2: KATTALASHTIRMAYDI — quti manba o‘lchamidan oshmaydi', () => {
    // `force_original_aspect_ratio=decrease` o'zi kichik videoni ham
    // qutiga cho'zib yuborardi; `min(box, iw)` shuni to'sadi.
    const vf = args()[args().indexOf('-vf') + 1];
    expect(vf).toContain(`min(${PROOF_VIDEO_BOX_PX},iw)`);
    expect(vf).toContain(`min(${PROOF_VIDEO_BOX_PX},ih)`);
    expect(vf).toContain('force_original_aspect_ratio=decrease');
  });

  it('TR3: o‘lchamlar JUFT songa tekislanadi', () => {
    // H.264 (yuv420p) toq o'lchamni qabul qilmaydi va ffmpeg yiqilardi.
    const vf = args()[args().indexOf('-vf') + 1];
    expect(vf).toContain('trunc(iw/2)*2:trunc(ih/2)*2');
  });

  it('TR4: OVOZSIZ video ham o‘tadi (`0:a:0?`)', () => {
    // `?` bo'lmasa ffmpeg "stream not found" bilan yiqilardi.
    const a = args();
    expect(a).toContain('0:a:0?');
    expect(a).toContain('0:v:0');
  });

  it('TR5: brauzerda darhol ochilishi uchun `+faststart`', () => {
    expect(args()).toContain('+faststart');
  });

  it('TR6: sifat va kodek sozlamalari yagona manbadan', () => {
    const a = args();
    expect(a[a.indexOf('-crf') + 1]).toBe(String(PROOF_VIDEO_CRF));
    expect(a).toContain('libx264');
    expect(a).toContain('yuv420p');
  });
});

describe('Siqish — DALIL HECH QACHON YO‘QOLMAYDI', () => {
  it('TR7: ffmpeg yiqilsa ASL FAYL qoladi, holat `failed`', async () => {
    const s = svc();
    jest.spyOn(s, 'probeFfmpeg').mockResolvedValue(true);
    // `runFfmpeg` private — uni buzilgan manba orqali tabiiy yiqitamiz:
    // bizning faylimiz haqiqiy video emas, ffmpeg uni o'qiy olmaydi.
    const row = makeProof();
    const abs = resolveProofPath(row.rel_path, row.stored_name);

    const res = await s.transcodeOne(row.id);

    expect(['failed', 'skipped']).toContain(res);
    expect(fs.existsSync(abs)).toBe(true);
    expect(row.transcode_status).not.toBe(TRANSCODE.DONE);
  });

  it('TR8: ffmpeg YO‘Q bo‘lsa — `skipped`, fayl tegilmaydi', async () => {
    const s = svc();
    jest.spyOn(s, 'probeFfmpeg').mockResolvedValue(false);
    const row = makeProof();
    const abs = resolveProofPath(row.rel_path, row.stored_name);

    await expect(s.transcodeOne(row.id)).resolves.toBe('skipped');
    expect(fs.existsSync(abs)).toBe(true);
    expect(row.transcode_status).toBe(TRANSCODE.SKIPPED);
  });

  it('TR9: RASM siqilmaydi', async () => {
    const s = svc();
    const row = makeProof({ mime: 'image/jpeg' });
    await expect(s.transcodeOne(row.id)).resolves.toBe('skipped');
    expect(row.transcode_status).toBe(TRANSCODE.SKIPPED);
  });

  it('TR10: allaqachon ishlangan fayl QAYTA ishlanmaydi', async () => {
    // Navbat va CRON bir xil faylni olishi mumkin — ikkinchisi to'xtashi
    // kerak, aks holda ikkita ffmpeg bitta faylga tushardi.
    const s = svc();
    const row = makeProof({ transcode_status: TRANSCODE.DONE });
    await expect(s.transcodeOne(row.id)).resolves.toBe('skipped');
    expect(row.transcode_status).toBe(TRANSCODE.DONE);
  });

  it('TR11: mavjud bo‘lmagan yozuv — xato tashlamaydi', async () => {
    await expect(svc().transcodeOne(randomUUID())).resolves.toBe('skipped');
  });

  it('TR11b: BIR VAQTDA ikki chaqiruv — faqat BITTASI ishlaydi', async () => {
    /**
     * ⚠️ HAQIQIY XATO EDI. Xotiradagi navbat va CRON tergichi bir xil
     * faylni olishi mumkin; "holatni o'qib, keyin tekshirish" yetmaydi —
     * ikkalasi ham `pending` ni O'QIB ULGURADI.
     *
     * Oqibati: ikkita ffmpeg bitta faylga tushadi, ikkita chiqish fayli
     * yaratiladi, DB bittasiga ishora qiladi va IKKINCHISI diskda abadiy
     * qoladi (orfan tozalash faqat bog'lanmagan isbotlarni oladi).
     *
     * Qo'lda sinovda aynan shu ko'rilgan: logda ikkita "Video siqildi"
     * yozuvi va bitta ENOENT ogohlantirishi.
     */
    const s = svc();
    jest.spyOn(s, 'probeFfmpeg').mockResolvedValue(false);
    const row = makeProof();

    const [a, b] = await Promise.all([
      s.transcodeOne(row.id),
      s.transcodeOne(row.id),
    ]);

    // Ikkalasi ham `skipped` qaytaradi (ffmpeg yo'q), lekin DA'VO faqat
    // bittasiga tegishi kerak — buni `update` chaqiruvlari soni ko'rsatadi.
    expect([a, b]).toEqual(['skipped', 'skipped']);
    const claims = (repo.update as jest.Mock).mock.calls.filter(
      ([where, set]: any[]) =>
        where?.transcode_status === TRANSCODE.PENDING &&
        set?.transcode_status === TRANSCODE.WORKING,
    );
    expect(claims.length).toBeLessThanOrEqual(1);
  });
});

describe('Navbat', () => {
  it('TR12: bir xil id IKKI MARTA navbatga tushmaydi', () => {
    const s = svc();
    jest.spyOn(s, 'probeFfmpeg').mockResolvedValue(false);
    const id = randomUUID();
    s.enqueue(id);
    s.enqueue(id);
    // Navbat sinxron to'ldiriladi, drenaj esa keyingi mikrotaskda boshlanadi.
    expect(s.pendingCount).toBeLessThanOrEqual(1);
  });

  it('TR13: bo‘sh id e’tiborsiz qoldiriladi', () => {
    const s = svc();
    s.enqueue('');
    expect(s.pendingCount).toBe(0);
  });
});

describe('ffmpeg mavjudligi', () => {
  it('TR14: natija KESHLANADI (har video uchun jarayon ochilmaydi)', async () => {
    const s = svc();
    const first = await s.probeFfmpeg();
    const second = await s.probeFfmpeg();
    expect(first).toBe(second);
    expect(typeof first).toBe('boolean');
  });
});

describe('Haqiqiy ffmpeg bilan uchdan-uchiga', () => {
  /**
   * ⚠️ Bu test ffmpeg O'RNATILGAN mashinada ishlaydi; bo'lmasa o'tkazib
   * yuboriladi. CI'da ffmpeg bo'lmasligi mumkin, lekin ishlab chiqarishda
   * u BOR — shuning uchun mavjud bo'lganda haqiqiy siqishni tekshiramiz.
   */
  const hasFfmpeg = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('child_process').execFileSync('ffmpeg', ['-version'], {
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  })();

  (hasFfmpeg ? it : it.skip)(
    'TR15: haqiqiy video SIQILADI va asl fayl o‘chadi',
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { execFileSync } = require('child_process');
      const rel = ensureProofSubdir(new Date());
      const srcName = `${randomUUID()}.mp4`;
      const srcAbs = resolveProofPath(rel, srcName);
      cleanup.push(srcAbs);

      // 2 soniyalik 1080p sinov videosi — ataylab KATTA bitreyt bilan,
      // siqish haqiqatan kamaytirishini ko'rsatish uchun.
      execFileSync(
        'ffmpeg',
        [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30:duration=2',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0',
          '-pix_fmt', 'yuv420p',
          srcAbs,
        ],
        { stdio: 'ignore' },
      );

      const originalSize = fs.statSync(srcAbs).size;
      const row = makeProofFromExisting(rel, srcName, originalSize);

      const s = svc();
      const res = await s.transcodeOne(row.id);

      expect(res).toBe('done');
      expect(row.transcode_status).toBe(TRANSCODE.DONE);
      expect(row.mime).toBe('video/mp4');
      expect(row.original_size_bytes).toBe(originalSize);
      expect(row.size_bytes).toBeLessThan(originalSize);

      // Yangi fayl BOR, eskisi YO'Q.
      const newAbs = resolveProofPath(row.rel_path, row.stored_name);
      cleanup.push(newAbs);
      expect(fs.existsSync(newAbs)).toBe(true);
      expect(fs.existsSync(srcAbs)).toBe(false);

      // 1080p → 720p ga tushgan bo'lishi kerak.
      const probe = execFileSync(
        'ffprobe',
        [
          '-v', 'error',
          '-select_streams', 'v:0',
          '-show_entries', 'stream=width,height',
          '-of', 'csv=p=0',
          newAbs,
        ],
        { encoding: 'utf8' },
      ).trim();
      const [w, h] = probe.split(',').map(Number);
      expect(Math.max(w, h)).toBeLessThanOrEqual(PROOF_VIDEO_BOX_PX);
    },
    120_000,
  );

  function makeProofFromExisting(
    rel: string,
    storedName: string,
    size: number,
  ): ExtraCostProofEntity {
    const row = {
      id: randomUUID(),
      rel_path: rel,
      stored_name: storedName,
      mime: 'video/mp4',
      size_bytes: size,
      transcode_status: TRANSCODE.PENDING,
      original_size_bytes: null,
    } as ExtraCostProofEntity;
    rows.set(row.id, row);
    return row;
  }
});
