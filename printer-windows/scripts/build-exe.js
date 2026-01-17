/**
 * EXE fayl yaratish scripti
 * pkg kutubxonasi orqali
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');

console.log('╔═══════════════════════════════════════════╗');
console.log('║     Building Beepost Printer EXE          ║');
console.log('╚═══════════════════════════════════════════╝');
console.log('');

try {
  // 1. Release papkasini yaratish
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  // 2. TypeScript compile
  console.log('Step 1/3: Compiling TypeScript...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

  // 3. EXE yaratish (pkg)
  console.log('');
  console.log('Step 2/3: Creating EXE file...');
  execSync(
    'npx pkg dist/index.js --targets node18-win-x64 --output release/beepost-printer.exe',
    { cwd: rootDir, stdio: 'inherit' }
  );

  // 4. Config faylni release ga copy
  console.log('');
  console.log('Step 3/3: Copying config files...');
  fs.copyFileSync(
    path.join(rootDir, 'config.json'),
    path.join(releaseDir, 'config.json')
  );

  // README yaratish
  const readme = `
BEEPOST PRINTER SERVICE - Windows Edition
==========================================

O'rnatish:
----------
1. "beepost-printer.exe" va "config.json" fayllarini bitta papkaga joylashtiring
2. config.json da MQTT sozlamalarini tekshiring
3. beepost-printer.exe ni administrator sifatida ishga tushiring

Yoki Windows Service sifatida:
------------------------------
1. Node.js o'rnatilgan bo'lishi kerak
2. npm install
3. npm run install-service

Test rejimi:
------------
beepost-printer.exe --test

Loglar:
-------
beepost-printer.log faylida

Muammolar:
----------
1. Printer topilmasa - USB ulanishni tekshiring
2. MQTT ulanmasa - internet va server manzilini tekshiring
3. Print bo'lmasa - printer driver o'rnatilganligini tekshiring

`.trim();

  fs.writeFileSync(path.join(releaseDir, 'README.txt'), readme);

  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     BUILD COMPLETED SUCCESSFULLY!         ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  console.log('Output files:');
  console.log(`  - ${path.join(releaseDir, 'beepost-printer.exe')}`);
  console.log(`  - ${path.join(releaseDir, 'config.json')}`);
  console.log(`  - ${path.join(releaseDir, 'README.txt')}`);
  console.log('');

} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
