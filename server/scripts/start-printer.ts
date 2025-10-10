// scripts/start-printer.ts
import { connect } from '@ngrok/ngrok';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import * as path from 'path';
import config from '../src/config';

(async function () {
  try {
    const port = config.PORT_PRINT || 3000;
    const authtoken = config.NGROK_AUTHTOKEN;

    if (!authtoken) {
      throw new Error('❌ NGROK_AUTHTOKEN config faylida topilmadi');
    }

    console.log('🚀 Ngrok tunnel ochilmoqda...');
    const listener = await connect({
      addr: port,
      authtoken,
      region: 'in',
    });

    const publicUrl = listener.url();
    console.log(`✅ Ngrok URL: ${publicUrl}`);

    // ✅ .env faylni yangilash
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = await fs.readFile(envPath, 'utf-8');
      if (envContent.includes('PRINTER_URL=')) {
        envContent = envContent.replace(
          /PRINTER_URL=.*/g,
          `PRINTER_URL=${publicUrl}`,
        );
      } else {
        envContent += `\nPRINTER_URL=${publicUrl}`;
      }
    } else {
      envContent = `PORT=${port}\nPRINTER_URL=${publicUrl}`;
    }

    await fs.writeFile(envPath, envContent);
    console.log(`📝 .env fayl yangilandi (PRINTER_URL=${publicUrl})`);

    // ✅ NestJS serverni ishga tushirish
    console.log('🔁 NestJS server ishga tushirilmoqda...');
    const server = exec('npm run start:dev', {
      cwd: path.resolve(__dirname, '..'),
    });

    server.stdout?.on('data', (data) => process.stdout.write(data));
    server.stderr?.on('data', (data) => process.stderr.write(data));
  } catch (err) {
    console.error('❌ Xatolik:', err);
  }
})();
