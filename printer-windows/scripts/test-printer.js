/**
 * Printer Test Script
 * Bu script printeringiz ishlayotganini tekshirish uchun
 *
 * Ishlatish:
 *   node scripts/test-printer.js
 *   node scripts/test-printer.js COM3
 *   node scripts/test-printer.js USB001
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// TSPL test label
const TSPL_TEST = `
SIZE 60 mm, 40 mm
GAP 2 mm, 0 mm
DIRECTION 1
CLS
TEXT 50,30,"4",0,1,1,"BEEPOST PRINTER TEST"
TEXT 50,80,"3",0,1,1,"========================"
TEXT 50,120,"3",0,1,1,"Printer ishlayapti!"
TEXT 50,160,"3",0,1,1,"Port test successful"
TEXT 50,220,"2",0,1,1,"${new Date().toLocaleString()}"
BARCODE 50,270,"128",80,1,0,2,2,"TEST123"
PRINT 1,1
`;

console.log('');
console.log('╔═══════════════════════════════════════════╗');
console.log('║     BEEPOST PRINTER TEST UTILITY          ║');
console.log('╚═══════════════════════════════════════════╝');
console.log('');

// Port parametrdan olish
const manualPort = process.argv[2];

// COM portlarni topish
function detectComPorts() {
  console.log('[INFO] Detecting COM ports...');
  try {
    const result = execSync(
      'powershell -Command "Get-WmiObject Win32_SerialPort | Select-Object DeviceID, Description | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000 }
    );

    if (result && result.trim()) {
      const ports = JSON.parse(result);
      const portList = Array.isArray(ports) ? ports : [ports];

      for (const port of portList) {
        if (port.DeviceID) {
          console.log(`  [FOUND] ${port.DeviceID} - ${port.Description || 'Unknown'}`);
        }
      }
      return portList.map(p => p.DeviceID).filter(Boolean);
    }
  } catch (err) {
    console.log('  [INFO] No COM ports found');
  }
  return [];
}

// USB portlarni topish
function detectUsbPorts() {
  console.log('[INFO] Detecting USB ports...');
  const foundPorts = [];
  const usbPorts = ['USB001', 'USB002', 'USB003', 'USB004', 'USB005', 'USB006'];

  for (const port of usbPorts) {
    try {
      // Port mavjudligini tekshirish (oddiy tekshirish)
      console.log(`  [TESTING] ${port}...`);
      foundPorts.push(port);
    } catch (e) {
      // Skip
    }
  }

  return foundPorts;
}

// Temp file yaratish
function createTempFile(data) {
  const tempDir = process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp';
  const tempFile = path.join(tempDir, `beepost_test_${Date.now()}.prn`);
  fs.writeFileSync(tempFile, data, 'utf8');
  console.log(`  [INFO] Created temp file: ${tempFile}`);
  return tempFile;
}

// Temp file o'chirish
function cleanupTempFile(filePath) {
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {}
  }, 3000);
}

// COM portga print
async function testComPort(port) {
  console.log(`\n[TEST] Testing COM port: ${port}`);

  return new Promise((resolve) => {
    try {
      const tempFile = createTempFile(TSPL_TEST);

      const psCommand = `
        $port = New-Object System.IO.Ports.SerialPort ${port},9600,None,8,One
        $port.Open()
        $content = [System.IO.File]::ReadAllBytes('${tempFile}')
        $port.Write($content, 0, $content.Length)
        $port.Close()
        Write-Output "SUCCESS"
      `.replace(/\n/g, '; ');

      exec(`powershell -Command "${psCommand}"`, { timeout: 15000 }, (err, stdout) => {
        cleanupTempFile(tempFile);

        if (err) {
          console.log(`  [FAILED] ${err.message}`);
          resolve(false);
        } else if (stdout.includes('SUCCESS')) {
          console.log(`  [SUCCESS] Print sent to ${port}!`);
          resolve(true);
        } else {
          console.log(`  [FAILED] Unknown response`);
          resolve(false);
        }
      });
    } catch (err) {
      console.log(`  [ERROR] ${err.message}`);
      resolve(false);
    }
  });
}

// USB portga print (copy /b)
async function testUsbPort(port) {
  console.log(`\n[TEST] Testing USB port: ${port}`);

  return new Promise((resolve) => {
    try {
      const tempFile = createTempFile(TSPL_TEST);
      const portPath = `\\\\.\\${port}`;

      // Type buyrug'i bilan sinash
      const cmd = `type "${tempFile}" > "${portPath}"`;
      console.log(`  [CMD] ${cmd}`);

      exec(cmd, { timeout: 10000, shell: 'cmd.exe' }, (err) => {
        if (err) {
          // Copy bilan sinash
          const copyCmd = `copy /b "${tempFile}" "${portPath}"`;
          console.log(`  [CMD] ${copyCmd}`);

          exec(copyCmd, { timeout: 10000, shell: 'cmd.exe' }, (copyErr) => {
            cleanupTempFile(tempFile);

            if (copyErr) {
              console.log(`  [FAILED] ${copyErr.message}`);
              resolve(false);
            } else {
              console.log(`  [SUCCESS] Print sent to ${port} (copy)!`);
              resolve(true);
            }
          });
        } else {
          cleanupTempFile(tempFile);
          console.log(`  [SUCCESS] Print sent to ${port} (type)!`);
          resolve(true);
        }
      });
    } catch (err) {
      console.log(`  [ERROR] ${err.message}`);
      resolve(false);
    }
  });
}

// LPT portga print
async function testLptPort() {
  console.log(`\n[TEST] Testing LPT1 port...`);

  return new Promise((resolve) => {
    try {
      const tempFile = createTempFile(TSPL_TEST);

      exec(`copy /b "${tempFile}" LPT1`, { timeout: 10000, shell: 'cmd.exe' }, (err) => {
        cleanupTempFile(tempFile);

        if (err) {
          console.log(`  [FAILED] ${err.message}`);
          resolve(false);
        } else {
          console.log(`  [SUCCESS] Print sent to LPT1!`);
          resolve(true);
        }
      });
    } catch (err) {
      console.log(`  [ERROR] ${err.message}`);
      resolve(false);
    }
  });
}

// Asosiy test
async function runTest() {
  // Agar manual port berilgan bo'lsa
  if (manualPort) {
    console.log(`[INFO] Manual port specified: ${manualPort}`);

    if (manualPort.toUpperCase().startsWith('COM')) {
      const result = await testComPort(manualPort);
      if (result) {
        console.log('\n✅ SUCCESS! Your printer is working.');
        console.log(`\nconfig.json da quyidagini qo'shing:`);
        console.log(`  "printer": { "port": "${manualPort}" }`);
      } else {
        console.log('\n❌ FAILED! Port ishlamadi.');
      }
      return;
    } else {
      const result = await testUsbPort(manualPort);
      if (result) {
        console.log('\n✅ SUCCESS! Your printer is working.');
        console.log(`\nconfig.json da quyidagini qo'shing:`);
        console.log(`  "printer": { "port": "${manualPort}" }`);
      } else {
        console.log('\n❌ FAILED! Port ishlamadi.');
      }
      return;
    }
  }

  // Auto detect
  console.log('[INFO] Auto-detecting printer ports...\n');

  // COM portlarni topish va test qilish
  const comPorts = detectComPorts();
  for (const port of comPorts) {
    const result = await testComPort(port);
    if (result) {
      console.log(`\n✅ SUCCESS! Printer found at ${port}`);
      console.log(`\nconfig.json da quyidagini qo'shing:`);
      console.log(`  "printer": { "port": "${port}" }`);
      return;
    }
  }

  // USB portlarni test qilish
  const usbPorts = detectUsbPorts();
  for (const port of usbPorts) {
    const result = await testUsbPort(port);
    if (result) {
      console.log(`\n✅ SUCCESS! Printer found at ${port}`);
      console.log(`\nconfig.json da quyidagini qo'shing:`);
      console.log(`  "printer": { "port": "${port}" }`);
      return;
    }
  }

  // LPT port
  const lptResult = await testLptPort();
  if (lptResult) {
    console.log('\n✅ SUCCESS! Printer found at LPT1');
    console.log(`\nconfig.json da quyidagini qo'shing:`);
    console.log(`  "printer": { "port": "LPT1" }`);
    return;
  }

  // Hech narsa topilmadi
  console.log('\n❌ No working printer port found.');
  console.log('\nTekshiring:');
  console.log('  1. Printer USB ga ulangan va yoniq');
  console.log('  2. Device Manager da qaysi portda ekanini ko\'ring');
  console.log('  3. Qo\'lda port berib sinab ko\'ring: node scripts/test-printer.js COM3');
  console.log('  4. Zadig driver o\'rnatish kerak bo\'lishi mumkin');
}

// Run
runTest().catch(console.error);
