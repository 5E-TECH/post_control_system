#!/usr/bin/env node
/**
 * audit:roles — RolesGuard fail-closed himoyasini muhofaza qiladi.
 *
 * `RolesGuard` fail-closed (roles.guard.ts): agar endpoint `RolesGuard` bilan
 * himoyalangan bo'lsa-yu, `@AcceptRoles(...)` e'lon qilmagan bo'lsa — hech kimga
 * ruxsat berilmaydi (403). Bu skript aynan shunday handlerlarni topadi: agar
 * bittasi topilsa, u endpoint jimgina o'lik bo'lib qoladi. Topilsa exit code 1
 * (CI'da build fail bo'ladi).
 *
 * Class-level va method-level @UseGuards/@AcceptRoles ikkalasi ham hisobga olinadi
 * (guard `getAllAndOverride([handler, class])` ishlatgani sababli).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'src');

const HTTP = /@(Get|Post|Put|Patch|Delete|All)\(/;
const isDecoratorStart = (l) => l.trim().startsWith('@');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(p, acc);
    } else if (name.endsWith('.controller.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

function depthDelta(s) {
  let d = 0;
  for (const c of s) {
    if (c === '(' || c === '{' || c === '[') d++;
    else if (c === ')' || c === '}' || c === ']') d--;
  }
  return d;
}

const files = walk(ROOT);
const flagged = [];

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const classIdx = lines.findIndex((l) => /export\s+class\s+\w*Controller/.test(l));
  if (classIdx < 0) continue;

  // Class-level dekoratorlar: class e'lonidan yuqoridagi uzluksiz blok.
  let j = classIdx - 1;
  while (j >= 0 && lines[j].trim() === '') j--;
  const classBlock = [];
  while (j >= 0 && lines[j].trim() !== '') {
    classBlock.unshift(lines[j]);
    j--;
  }
  const classText = classBlock.join('\n');
  const classHasRG = /RolesGuard/.test(classText);
  const classHasAR = /@AcceptRoles/.test(classText);

  // Method handlerlarni ajratamiz.
  let i = classIdx + 1;
  while (i < lines.length) {
    if (!isDecoratorStart(lines[i])) {
      i++;
      continue;
    }
    const start = i;
    const buf = [];
    let depth = 0;
    while (i < lines.length) {
      const l = lines[i];
      buf.push(l);
      depth += depthDelta(l);
      i++;
      if (depth <= 0) {
        if (isDecoratorStart(lines[i] ?? '')) {
          depth = 0;
          continue;
        }
        break;
      }
    }
    const blockText = buf.join('\n');
    if (!HTTP.test(blockText)) continue;

    const hasRG = classHasRG || /RolesGuard/.test(blockText);
    const hasAR = classHasAR || /@AcceptRoles/.test(blockText);
    if (hasRG && !hasAR) {
      const route = (blockText.match(/@(Get|Post|Put|Patch|Delete|All)\([^)]*\)/) || [''])[0];
      flagged.push({
        file: path.relative(ROOT, file),
        line: start + 1,
        route,
      });
    }
  }
}

if (flagged.length) {
  console.error(
    `\n❌ audit:roles — RolesGuard bilan himoyalangan, lekin @AcceptRoles YO'Q ${flagged.length} ta handler topildi.`,
  );
  console.error(
    "   Fail-closed guard sababli bu endpointlar hamma uchun 403 qaytaradi (o'lik).\n",
  );
  for (const f of flagged) console.error(`   src/${f.file}:${f.line}  ${f.route}`);
  console.error(
    "\n   Yechim: har biriga to'g'ri @AcceptRoles(...) qo'shing (yoki RolesGuard'ni olib tashlang).\n",
  );
  process.exit(1);
}

console.log(
  `✅ audit:roles — ${files.length} ta controller tekshirildi. RolesGuard'li har bir handler @AcceptRoles bilan himoyalangan.`,
);
process.exit(0);
