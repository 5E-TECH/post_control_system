/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { Roles } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { ExtraCostProofService } from './extra-cost-proof.service';
import {
  PROOF_DIR,
  PROOF_MAX_FILES,
  PROOF_MAX_VIDEO_BYTES,
  UPLOAD_ROOT,
  resolveProofPath,
} from './proof-storage.const';

/**
 * ISBOT SERVISI.
 *
 * Uchta mustaqil xavf sinaladi:
 *
 *   1. SAQLANGAN XSS — fayl bizning domenimizdan beriladi. `.jpg` deb
 *      nomlangan HTML/SVG saqlansa, uni ochgan market brauzerida skript
 *      ishlardi. Tur FAQAT mazmun (magic byte) bo'yicha aniqlanishi kerak.
 *
 *   2. IDOR — isbot pul nizosining hujjati. Boshqa marketning yoki boshqa
 *      kuryerning isbotini ko'rib bo'lmasligi shart.
 *
 *   3. YETIM FAYL — yozildi-yu DB yozuvi bo'lmadi (yoki aksincha). Ikkalasi
 *      ham nizoda dalilsiz qolishga olib keladi.
 */

// ── Soxta repozitoriylar ────────────────────────────────────────────────────
function makeRepos() {
  const proofs: ExtraCostProofEntity[] = [];
  const requests: ExtraCostRequestEntity[] = [];
  let seq = 0;

  const proofRepo = {
    create: (d: Partial<ExtraCostProofEntity>) =>
      ({ ...d }) as ExtraCostProofEntity,
    save: jest.fn((row: ExtraCostProofEntity) => {
      row.id = row.id ?? `proof-${++seq}`;
      row.created_at = row.created_at ?? Date.now();
      proofs.push(row);
      return Promise.resolve(row);
    }),
    find: jest.fn(({ where }: any) => {
      const ids: string[] = where.id?._value ?? [];
      return Promise.resolve(
        proofs.filter(
          (p) =>
            ids.includes(p.id) &&
            p.courier_id === where.courier_id &&
            p.request_id === null,
        ),
      );
    }),
    findOne: jest.fn(({ where }: any) =>
      Promise.resolve(proofs.find((p) => p.id === where.id) ?? null),
    ),
    delete: jest.fn((where: any) => {
      const i = proofs.findIndex((p) => p.id === where.id);
      if (i >= 0) proofs.splice(i, 1);
      return Promise.resolve({ affected: 1 });
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        where: () => qb,
        andWhere: () => qb,
        limit: () => qb,
        getCount: () => Promise.resolve(0),
        getMany: () => Promise.resolve([]),
      };
      return qb;
    }),
  } as unknown as Repository<ExtraCostProofEntity>;

  const requestRepo = {
    findOne: jest.fn(({ where }: any) =>
      Promise.resolve(requests.find((r) => r.id === where.id) ?? null),
    ),
  } as unknown as Repository<ExtraCostRequestEntity>;

  return { proofRepo, requestRepo, proofs, requests };
}

// ── Haqiqiy fayl boshlari (magic byte) ──────────────────────────────────────
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(40, 1),
]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(40, 1),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4, 0),
  Buffer.from('WEBP'),
  Buffer.alloc(40, 1),
]);
const HEIC = Buffer.concat([
  Buffer.alloc(4, 0),
  Buffer.from('ftypheic'),
  Buffer.alloc(40, 1),
]);
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');
const MP4 = Buffer.concat([
  Buffer.alloc(4, 0),
  Buffer.from('ftypisom'),
  Buffer.alloc(40, 1),
]);
const MOV = Buffer.concat([
  Buffer.alloc(4, 0),
  Buffer.from('ftypqt  '),
  Buffer.alloc(40, 1),
]);
const WEBM = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
  Buffer.alloc(40, 1),
]);
/** Noma'lum ISO-BMFF brendi — oq ro'yxat tamoyili bo'yicha RAD ETILADI. */
const UNKNOWN_FTYP = Buffer.concat([
  Buffer.alloc(4, 0),
  Buffer.from('ftypXXXX'),
  Buffer.alloc(40, 1),
]);

/**
 * ⚠️ FAYL ENDI DISKDAN KELADI.
 *
 * Servis multer'ning `diskStorage` idan `{ path, size }` oladi (avval
 * `memoryStorage` dan `{ buffer, size }` olardi). Sabab: video 80 MB gacha
 * bo'lishi mumkin va uni RAM'ga o'qish serverni OOM bilan o'ldirardi.
 * Shuning uchun testlar ham haqiqiy vaqtinchalik fayl yozadi.
 */
/**
 * ⚠️ `PROOF_TMP_DIR` ATAYLAB ISHLATILMAYDI.
 *
 * U multer'niki, va `extra-cost.controller.spec.ts` o'z ishidan keyin uni
 * BUTUNLAY tozalaydi. Jest testlarni PARALLEL ishlatadi, ya'ni o'sha
 * tozalash shu testning fayllarini ham o'chirib yuborardi (test yolg'iz
 * o'tib, to'liq to'plamda yiqilardi — aynan shunday bo'lgan).
 *
 * `UPLOAD_ROOT` ichidagi alohida papka — `rename` bitta fayl tizimida
 * qolishi uchun (`/tmp` boshqa disk bo'lishi va EXDEV berishi mumkin).
 */
const SPEC_TMP = path.join(UPLOAD_ROOT, 'spec-tmp-proof-service');

const asFile = (buffer: Buffer, originalname = 'x.jpg') => {
  fs.mkdirSync(SPEC_TMP, { recursive: true });
  const tmp = path.join(SPEC_TMP, `${randomUUID()}.part`);
  fs.writeFileSync(tmp, buffer);
  tmpPaths.push(tmp);
  return { path: tmp, size: buffer.length, originalname };
};

const COURIER = 'courier-1';
const writtenPaths: string[] = [];
const tmpPaths: string[] = [];

/** Siqish — alohida servis, bu yerda sinalmaydi. */
const transcodeStub = {
  enqueue: jest.fn(),
} as unknown as import('./proof-transcode.service').ProofTranscodeService;

function svc() {
  const r = makeRepos();
  return {
    service: new ExtraCostProofService(
      r.proofRepo,
      r.requestRepo,
      transcodeStub,
    ),
    ...r,
  };
}

afterAll(() => {
  // Test yozgan fayllarni tozalaymiz — repo/disk ifloslanmasin.
  for (const p of writtenPaths) fs.rmSync(p, { force: true });
  for (const p of tmpPaths) fs.rmSync(p, { force: true });
  fs.rmSync(SPEC_TMP, { recursive: true, force: true });
});

async function upload(buffers: Buffer[], names?: string[]) {
  const { service, proofs } = svc();
  const out = await service.saveUploaded(
    buffers.map((b, i) => asFile(b, names?.[i])),
    COURIER,
  );
  for (const p of proofs) {
    writtenPaths.push(resolveProofPath(p.rel_path, p.stored_name));
  }
  return { out, proofs };
}

describe("Isbot yuklash — fayl turi FAQAT mazmun bo'yicha", () => {
  it('TC1: JPEG/PNG/WEBP/HEIC qabul qilinadi', async () => {
    const { proofs } = await upload([JPEG, PNG, WEBP]);
    expect(proofs.map((p) => p.mime)).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    const heic = await upload([HEIC]);
    expect(heic.proofs[0].mime).toBe('image/heic');
  });

  it('TC2: `.jpg` deb nomlangan HTML RAD ETILADI', async () => {
    // Kengaytmaga ishonilsa — saqlangan XSS.
    await expect(upload([HTML], ['chek.jpg'])).rejects.toThrow(/Faqat rasm/);
  });

  it("TC3: SVG RAD ETILADI (ichida skript bo'lishi mumkin)", async () => {
    await expect(upload([SVG], ['chek.jpg'])).rejects.toThrow(/Faqat rasm/);
  });

  it('TC4: VIDEO (mp4/mov/webm) QABUL QILINADI', async () => {
    const a = await upload([MP4], ['video.mp4']);
    expect(a.proofs[0].mime).toBe('video/mp4');
    const b = await upload([MOV], ['iphone.mov']);
    expect(b.proofs[0].mime).toBe('video/quicktime');
    const c = await upload([WEBM], ['v.webm']);
    expect(c.proofs[0].mime).toBe('video/webm');
  });

  it("TC4b: NOMA'LUM ISO-BMFF brendi RAD ETILADI (oq ro'yxat tamoyili)", async () => {
    await expect(upload([UNKNOWN_FTYP], ['x.mp4'])).rejects.toThrow(
      /Faqat rasm/,
    );
  });

  it("TC5: juda qisqa fayl RAD ETILADI (magic byte o'qib bo'lmaydi)", async () => {
    await expect(upload([Buffer.from([0xff, 0xd8])])).rejects.toThrow(
      /Faqat rasm/,
    );
  });

  it('TC5b: video chegarasidan KATTA fayl RAD ETILADI', async () => {
    const big = Buffer.concat([
      Buffer.alloc(4, 0),
      Buffer.from('ftypisom'),
      Buffer.alloc(PROOF_MAX_VIDEO_BYTES + 1, 1),
    ]);
    await expect(upload([big], ['katta.mp4'])).rejects.toThrow(
      /Qisqaroq video/,
    );
  });

  it('TC5c: JAMI byudjetdan oshsa RAD ETILADI (fayllar alohida sig‘sa ham)', async () => {
    // ⚠️ Foydalanuvchi talabining o'zi: bitta video byudjetni to'ldirsa,
    // qolganiga joy yo'q. Har bir fayl ALOHIDA chegaradan o'tadi, lekin
    // YIG'INDI byudjetdan oshadi.
    const vid = (bytes: number) =>
      Buffer.concat([
        Buffer.alloc(4, 0),
        Buffer.from('ftypisom'),
        Buffer.alloc(bytes, 1),
      ]);
    const half = Math.floor(PROOF_MAX_VIDEO_BYTES * 0.9);
    await expect(upload([vid(half), vid(half)])).rejects.toThrow(
      /umumiy hajmi/,
    );
  });

  it('TC6: rad etilgan fayl DISKDA QOLMAYDI', async () => {
    const before = countFiles(PROOF_DIR);
    await expect(upload([JPEG, HTML])).rejects.toThrow();
    // Birinchi fayl yozilgan, lekin ikkinchisi rad etilgach o'chirilishi kerak.
    expect(countFiles(PROOF_DIR)).toBe(before);
  });
});

describe('Isbot yuklash — fayl nomi va mazmuni', () => {
  it('TC7: diskdagi nom FOYDALANUVCHIDAN olinmaydi', async () => {
    const { proofs } = await upload([JPEG], ['../../../etc/passwd.jpg']);
    expect(proofs[0].stored_name).not.toContain('passwd');
    expect(proofs[0].stored_name).not.toContain('..');
    expect(proofs[0].stored_name).toMatch(/^[0-9a-f-]{36}\.jpg$/);
  });

  it("TC8: kengaytma SERVERDA aniqlangan MIME'dan olinadi", async () => {
    // PNG yuborilib `.jpg` deb nomlansa ham, diskda `.png` bo'lishi kerak.
    const { proofs } = await upload([PNG], ['aldamchi.jpg']);
    expect(proofs[0].stored_name.endsWith('.png')).toBe(true);
  });

  it('TC9: sha256 hisoblanadi (dublikat aniqlash uchun)', async () => {
    const { proofs } = await upload([JPEG]);
    expect(proofs[0].sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("TC10: javobda fayl nomi ham, yo'li ham CHIQMAYDI", async () => {
    const { out } = await upload([JPEG]);
    const keys = Object.keys(out[0]).sort();
    expect(keys).toEqual(['dup_count', 'proof_id', 'size_bytes']);
  });

  it('TC11: fayl `YYYY/MM` papkasiga tushadi', async () => {
    const { proofs } = await upload([JPEG]);
    expect(proofs[0].rel_path).toMatch(/^\d{4}[/\\]\d{2}$/);
  });
});

describe("Isbot ko'rish — egalik (IDOR)", () => {
  const setup = () => {
    const s = svc();
    s.requests.push({
      id: 'req-1',
      courier_id: 'courier-1',
      market_id: 'market-1',
      proof_ids: ['proof-1'],
    } as ExtraCostRequestEntity);
    s.proofs.push({
      id: 'proof-1',
      rel_path: '2026/09',
      stored_name: 'x.jpg',
      mime: 'image/jpeg',
      size_bytes: 10,
    } as ExtraCostProofEntity);
    return s;
  };
  const who = (id: string, role: Roles) => ({ id, role }) as JwtPayload;

  it('TC12: BEGONA market RAD ETILADI', async () => {
    const { service } = setup();
    await expect(
      service.openForViewer('req-1', 'proof-1', who('market-2', Roles.MARKET)),
    ).rejects.toThrow(/huquqingiz/);
  });

  it('TC13: BEGONA kuryer RAD ETILADI', async () => {
    const { service } = setup();
    await expect(
      service.openForViewer(
        'req-1',
        'proof-1',
        who('courier-9', Roles.COURIER),
      ),
    ).rejects.toThrow(/huquqingiz/);
  });

  it("TC14: so'rovga TEGISHLI BO'LMAGAN isbot berilmaydi", async () => {
    // Market o'z so'rovining id'si bilan BOSHQA isbotni so'rashga urinadi.
    const { service } = setup();
    await expect(
      service.openForViewer(
        'req-1',
        'proof-999',
        who('market-1', Roles.MARKET),
      ),
    ).rejects.toThrow(/topilmadi/);
  });

  it("TC15: mavjud bo'lmagan so'rov — 404", async () => {
    const { service } = setup();
    await expect(
      service.openForViewer('yo-q', 'proof-1', who('market-1', Roles.MARKET)),
    ).rejects.toThrow(/topilmadi/);
  });

  it("TC16: fayl diskda yo'q bo'lsa aniq xato (buzilgan rasm emas)", async () => {
    const { service } = setup();
    await expect(
      service.openForViewer('req-1', 'proof-1', who('market-1', Roles.MARKET)),
    ).rejects.toThrow(/serverda topilmadi/);
  });
});

describe("Isbot bog'lash — validateOwnedUnbound", () => {
  it('TC17: BOSHQA kuryerning isboti biriktirilmaydi', async () => {
    const { service, proofs } = svc();
    proofs.push({
      id: 'p1',
      courier_id: 'boshqa-kuryer',
      request_id: null,
    } as ExtraCostProofEntity);
    await expect(service.validateOwnedUnbound(['p1'], COURIER)).rejects.toThrow(
      /topilmadi yoki allaqachon/,
    );
  });

  it("TC18: ALLAQACHON bog'langan isbot qayta ishlatilmaydi", async () => {
    const { service, proofs } = svc();
    proofs.push({
      id: 'p1',
      courier_id: COURIER,
      request_id: 'req-boshqa',
    } as ExtraCostProofEntity);
    await expect(service.validateOwnedUnbound(['p1'], COURIER)).rejects.toThrow(
      /topilmadi yoki allaqachon/,
    );
  });

  it("TC19: chegaradan ko'p isbot RAD ETILADI", async () => {
    // ⚠️ Qattiq raqam EMAS — chegara `proof-storage.const.ts` dan olinadi.
    // Aks holda chegara o'zgarganda test jimgina boshqa narsani sinardi.
    const { service } = svc();
    const tooMany = Array.from(
      { length: PROOF_MAX_FILES + 1 },
      (_, i) => `p${i}`,
    );
    await expect(
      service.validateOwnedUnbound(tooMany, COURIER),
    ).rejects.toThrow(/Eng ko'pi/);
  });

  it("TC20: bo'sh ro'yxat — xato emas (isbotsiz davom etish)", async () => {
    const { service } = svc();
    await expect(service.validateOwnedUnbound([], COURIER)).resolves.toEqual(
      [],
    );
  });
});

/** PROOF_DIR ichidagi fayllar soni (rekursiv). */
function countFiles(dir: string): number {
  let n = 0;
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else n++;
    }
  };
  walk(dir);
  return n;
}
