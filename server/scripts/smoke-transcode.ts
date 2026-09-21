/**
 * QO'LDA SINOV: haqiqiy katta video → yuklash yo'li → ffmpeg siqish.
 *
 * Nima tekshiriladi (unit testlar QAMRAMAYDIGAN qism):
 *   - HAQIQIY mp4 ning magic-byte'i to'g'ri aniqlanadimi (test fayllari
 *     sun'iy bayt to'plami edi)
 *   - 50 MB lik fayl XOTIRAGA o'qilmasdan ishlanadimi (disk yo'li)
 *   - sha256 oqim bilan hisoblanadimi
 *   - ffmpeg haqiqatan hajmni kamaytiradimi va DB yangilanadimi
 *
 * Ishga tushirish:  npx ts-node -r tsconfig-paths/register scripts/smoke-transcode.ts
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ExtraCostProofEntity } from 'src/core/entity/extra-cost-proof.entity';
import { ExtraCostRequestEntity } from 'src/core/entity/extra-cost-request.entity';
import { ExtraCostProofService } from 'src/api/extra-cost/extra-cost-proof.service';
import { ProofTranscodeService } from 'src/api/extra-cost/proof-transcode.service';
import {
  PROOF_TMP_DIR,
  resolveProofPath,
} from 'src/api/extra-cost/proof-storage.const';

const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DB_URL,
    // Bog'liq entity'lar (`courier` munosabati) ham kerak — aks holda
    // TypeORM metadata qura olmaydi.
    entities: ['src/core/entity/*.entity.ts'],
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  const proofRepo = ds.getRepository(ExtraCostProofEntity);
  const requestRepo = ds.getRepository(ExtraCostRequestEntity);
  const transcode = new ProofTranscodeService(proofRepo);
  await transcode.probeFfmpeg();
  const proofs = new ExtraCostProofService(proofRepo, requestRepo, transcode);

  // ── 1. HAQIQIY katta video yasaymiz (~8 s 1080p, siqilmagan) ──────────
  fs.mkdirSync(PROOF_TMP_DIR, { recursive: true });
  const srcTmp = path.join(PROOF_TMP_DIR, `${randomUUID()}.part`);
  console.log('▶ sinov videosi yaratilmoqda (1080p, 8 s, qp=0)…');
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30:duration=8',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    // `.part` kengaytmasidan ffmpeg konteynerni topa olmaydi — aniq aytamiz.
    // (Multer ham aynan shunday nom beradi, shuning uchun sinov haqiqatga mos.)
    '-f', 'mp4',
    srcTmp,
  ]);
  const srcSize = fs.statSync(srcTmp).size;
  console.log(`  manba: ${mb(srcSize)} MB`);

  // ── 2. Yuklash yo'li (multer `diskStorage` nima bersa, shu) ───────────
  const courierId =
    (await ds.query(
      `SELECT id FROM users WHERE role='courier' AND is_deleted=false LIMIT 1`,
    ))[0]?.id;
  if (!courierId) throw new Error('Kuryer topilmadi');

  const saved = await proofs.saveUploaded(
    [{ path: srcTmp, size: srcSize, originalname: 'isbot.mp4' }],
    courierId,
  );
  const proofId = saved[0].proof_id;
  const row = await proofRepo.findOneOrFail({ where: { id: proofId } });
  console.log(
    `✔ saqlandi: mime=${row.mime} hajm=${mb(row.size_bytes)} MB ` +
      `holat=${row.transcode_status} sha256=${row.sha256.slice(0, 12)}…`,
  );
  if (row.mime !== 'video/mp4') throw new Error(`MIME xato: ${row.mime}`);
  // `saveUploaded` fonda navbatni ishga tushiradi, shuning uchun holat shu
  // lahzada `pending`, `working` yoki hatto `done` bo'lishi mumkin.
  if (!['pending', 'working', 'done'].includes(row.transcode_status ?? '')) {
    throw new Error(`Navbatga tushmadi: ${row.transcode_status}`);
  }
  if (fs.existsSync(srcTmp)) throw new Error('Vaqtinchalik fayl qolib ketdi');

  // ── 3. Fon navbati tugashini kutamiz ─────────────────────────────────
  //
  // ⚠️ POYGA SINOVI HAM SHU YERDA. `saveUploaded` allaqachon navbatni
  // ishga tushirgan; biz PARALLEL yana chaqiramiz. Ilgari bu yerda haqiqiy
  // xato chiqqan: bitta video IKKI MARTA siqilib, ikkinchi chiqish fayli
  // diskda abadiy qolib ketgan (logda ikkita "Video siqildi" va bitta
  // ENOENT). Endi atomik da'vo (`UPDATE ... WHERE status='pending'`)
  // buni to'sadi.
  console.log('▶ siqilmoqda (parallel chaqiruv — poyga sinovi)…');
  const t0 = Date.now();
  const filesBefore = countProofFiles(row.rel_path);

  const extra = await Promise.all([
    transcode.transcodeOne(proofId),
    transcode.transcodeOne(proofId),
  ]);
  console.log(`  parallel chaqiruv natijalari: ${extra.join(' / ')}`);

  const after = await waitTerminal(proofRepo, proofId);
  const res = after.transcode_status;
  const abs = resolveProofPath(after.rel_path, after.stored_name);

  // Bitta video → diskda BITTA yangi fayl (eskisi o'chadi), ya'ni jami
  // fayl soni O'ZGARMAYDI. Ikki marta siqilganda +1 fayl qolardi.
  const filesAfter = countProofFiles(after.rel_path);
  if (filesAfter > filesBefore) {
    throw new Error(
      `POYGA: diskda ortiqcha fayl qoldi (${filesBefore} → ${filesAfter})`,
    );
  }

  console.log(
    `✔ natija=${res} ${mb(after.original_size_bytes ?? 0)} MB → ` +
      `${mb(after.size_bytes)} MB ` +
      `(${Math.round((1 - after.size_bytes / (after.original_size_bytes || 1)) * 100)}% kamaydi, ` +
      `${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
  console.log(`  diskdagi fayl soni: ${filesBefore} → ${filesAfter} (o'zgarmasligi kerak)`);

  if (res !== 'done') throw new Error(`Siqilmadi: ${res}`);
  if (!fs.existsSync(abs)) throw new Error('Yangi fayl yo‘q');
  if (after.size_bytes >= srcSize) throw new Error('Hajm kamaymadi');

  const probe = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', abs,
  ], { encoding: 'utf8' }).trim();
  console.log(`  o‘lcham: ${probe} (1920,1080 dan)`);

  // ── 4. Tozalash ──────────────────────────────────────────────────────
  fs.rmSync(abs, { force: true });
  await proofRepo.delete({ id: proofId });
  await ds.destroy();
  console.log('\n🎉 Uchdan-uchiga sinov O‘TDI');
}

/** Yakuniy holatga o'tguncha kutadi (fon navbati tugashi). */
async function waitTerminal(repo: any, id: string, ms = 60_000) {
  const until = Date.now() + ms;
  for (;;) {
    const row = await repo.findOneOrFail({ where: { id } });
    if (['done', 'skipped', 'failed'].includes(row.transcode_status ?? '')) {
      return row;
    }
    if (Date.now() > until) {
      throw new Error(`Siqish tugamadi: ${row.transcode_status}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

function countProofFiles(rel: string): number {
  const dir = path.dirname(resolveProofPath(rel, 'x'));
  try {
    return fs.readdirSync(dir).length;
  } catch {
    return 0;
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
