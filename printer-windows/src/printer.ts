import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import { exec, execSync } from 'child_process';

/**
 * Windows Printer class - TSPL thermal printer uchun
 * USB Raw Device sifatida ulangan printerlar uchun
 */
export class TsplPrinter {
  private printerPort: string | null = null;
  private comPort: string | null = null;

  constructor() {
    this.detectPrinter();
  }

  /**
   * USB printer portini aniqlash
   */
  private detectPrinter(): void {
    try {
      logger.info('Detecting USB printer...');

      // 1. USB Serial portlarni tekshirish (COM portlar)
      this.detectComPorts();

      // 2. USB printer portlarni tekshirish
      this.detectUsbPorts();

      if (this.comPort) {
        logger.success(`Found COM port: ${this.comPort}`);
      } else if (this.printerPort) {
        logger.success(`Found USB port: ${this.printerPort}`);
      } else {
        logger.warn('No printer port found. Will try common ports...');
      }
    } catch (err: any) {
      logger.error('Printer detection failed:', err.message);
    }
  }

  /**
   * COM portlarni aniqlash
   */
  private detectComPorts(): void {
    try {
      // PowerShell orqali COM portlarni olish
      const result = execSync(
        'powershell -Command "Get-WmiObject Win32_SerialPort | Select-Object DeviceID, Description | ConvertTo-Json"',
        { encoding: 'utf8', timeout: 10000 }
      );

      if (result && result.trim()) {
        const ports = JSON.parse(result);
        const portList = Array.isArray(ports) ? ports : [ports];

        for (const port of portList) {
          if (port.DeviceID) {
            logger.info(`  Found COM: ${port.DeviceID} - ${port.Description || ''}`);
            // USB-Serial adapter yoki printer
            if (!this.comPort) {
              this.comPort = port.DeviceID;
            }
          }
        }
      }
    } catch (err) {
      // COM port topilmadi - bu normal
    }
  }

  /**
   * USB portlarni aniqlash
   */
  private detectUsbPorts(): void {
    try {
      // USB portlarni tekshirish
      const usbPorts = ['USB001', 'USB002', 'USB003', 'USB004', 'USB005'];

      for (const port of usbPorts) {
        try {
          // Port mavjudligini tekshirish
          const testCmd = `powershell -Command "Test-Path \\\\.\\${port}"`;
          const result = execSync(testCmd, { encoding: 'utf8', timeout: 5000 });

          if (result.trim().toLowerCase() === 'true') {
            logger.info(`  Found USB port: ${port}`);
            if (!this.printerPort) {
              this.printerPort = port;
            }
          }
        } catch (e) {
          // Port mavjud emas
        }
      }
    } catch (err) {
      // USB port topilmadi
    }

    // Agar hech narsa topilmasa, default USB001
    if (!this.printerPort && !this.comPort) {
      this.printerPort = 'USB001';
      logger.info('Using default port: USB001');
    }
  }

  /**
   * TSPL buyruqni printerga yuborish
   */
  async print(tsplCommand: string): Promise<boolean> {
    logger.info('Starting print process...');

    // 1-usul: COM port orqali
    if (this.comPort) {
      const comResult = await this.printToComPort(tsplCommand);
      if (comResult) return true;
    }

    // 2-usul: USB port orqali (copy /b)
    const usbResult = await this.printToUsbPort(tsplCommand);
    if (usbResult) return true;

    // 3-usul: Barcha USB portlarni sinab ko'rish
    const tryAllResult = await this.tryAllPorts(tsplCommand);
    if (tryAllResult) return true;

    // 4-usul: LPT port (parallel port)
    const lptResult = await this.printToLptPort(tsplCommand);
    if (lptResult) return true;

    logger.error('All print methods failed');
    return false;
  }

  /**
   * COM port orqali print
   */
  private async printToComPort(data: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.comPort) {
        resolve(false);
        return;
      }

      try {
        logger.info(`Trying COM port: ${this.comPort}`);

        // PowerShell orqali COM portga yozish
        const tempFile = this.createTempFile(data);

        const psCommand = `
          $port = New-Object System.IO.Ports.SerialPort ${this.comPort},9600,None,8,One
          $port.Open()
          $content = [System.IO.File]::ReadAllBytes('${tempFile}')
          $port.Write($content, 0, $content.Length)
          $port.Close()
        `.replace(/\n/g, '; ');

        exec(`powershell -Command "${psCommand}"`, { timeout: 15000 }, (err) => {
          this.cleanupTempFile(tempFile);

          if (err) {
            logger.warn(`COM port print failed: ${err.message}`);
            resolve(false);
          } else {
            logger.success('COM port print completed');
            resolve(true);
          }
        });
      } catch (err: any) {
        logger.warn(`COM port error: ${err.message}`);
        resolve(false);
      }
    });
  }

  /**
   * USB port orqali print (copy /b)
   */
  private async printToUsbPort(data: string): Promise<boolean> {
    return new Promise((resolve) => {
      const port = this.printerPort || 'USB001';

      try {
        logger.info(`Trying USB port: ${port}`);

        const tempFile = this.createTempFile(data);
        const portPath = `\\\\.\\${port}`;

        // type buyrug'i bilan yuborish (copy dan ko'ra yaxshiroq)
        const cmd = `type "${tempFile}" > "${portPath}"`;

        exec(cmd, { timeout: 10000, shell: 'cmd.exe' }, (err) => {
          // Agar type ishlamasa, copy sinab ko'ramiz
          if (err) {
            const copyCmd = `copy /b "${tempFile}" "${portPath}"`;
            exec(copyCmd, { timeout: 10000, shell: 'cmd.exe' }, (copyErr) => {
              this.cleanupTempFile(tempFile);

              if (copyErr) {
                logger.warn(`USB port print failed: ${copyErr.message}`);
                resolve(false);
              } else {
                logger.success('USB port print completed (copy)');
                resolve(true);
              }
            });
          } else {
            this.cleanupTempFile(tempFile);
            logger.success('USB port print completed (type)');
            resolve(true);
          }
        });
      } catch (err: any) {
        logger.warn(`USB port error: ${err.message}`);
        resolve(false);
      }
    });
  }

  /**
   * Barcha USB portlarni sinab ko'rish
   */
  private async tryAllPorts(data: string): Promise<boolean> {
    const ports = ['USB001', 'USB002', 'USB003', 'USB004', 'USB005', 'USB006'];

    for (const port of ports) {
      logger.info(`Trying port: ${port}`);

      const result = await new Promise<boolean>((resolve) => {
        try {
          const tempFile = this.createTempFile(data);
          const portPath = `\\\\.\\${port}`;

          exec(`copy /b "${tempFile}" "${portPath}"`, { timeout: 5000, shell: 'cmd.exe' }, (err) => {
            this.cleanupTempFile(tempFile);

            if (!err) {
              logger.success(`Print completed on port: ${port}`);
              this.printerPort = port; // Keyingi safar bu portni ishlatamiz
              resolve(true);
            } else {
              resolve(false);
            }
          });
        } catch (e) {
          resolve(false);
        }
      });

      if (result) return true;
    }

    return false;
  }

  /**
   * LPT (parallel) port orqali print
   */
  private async printToLptPort(data: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        logger.info('Trying LPT1 port...');

        const tempFile = this.createTempFile(data);

        exec(`copy /b "${tempFile}" LPT1`, { timeout: 10000, shell: 'cmd.exe' }, (err) => {
          this.cleanupTempFile(tempFile);

          if (err) {
            logger.warn('LPT port print failed');
            resolve(false);
          } else {
            logger.success('LPT port print completed');
            resolve(true);
          }
        });
      } catch (err: any) {
        logger.warn(`LPT port error: ${err.message}`);
        resolve(false);
      }
    });
  }

  /**
   * Temp file yaratish
   */
  private createTempFile(data: string): string {
    const tempDir = process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp';
    const tempFile = path.join(tempDir, `beepost_${Date.now()}.prn`);
    fs.writeFileSync(tempFile, data, 'utf8');
    logger.info(`Created temp file: ${tempFile}`);
    return tempFile;
  }

  /**
   * Temp file o'chirish
   */
  private cleanupTempFile(filePath: string): void {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) { }
    }, 2000);
  }

  /**
   * Printer holatini tekshirish
   */
  isReady(): boolean {
    return this.printerPort !== null || this.comPort !== null;
  }

  /**
   * Printer ma'lumotlarini olish
   */
  getInfo(): { usbPort: string | null; comPort: string | null } {
    return {
      usbPort: this.printerPort,
      comPort: this.comPort,
    };
  }

  /**
   * Portni qo'lda sozlash
   */
  setPort(port: string): void {
    if (port.toUpperCase().startsWith('COM')) {
      this.comPort = port.toUpperCase();
      logger.info(`COM port set to: ${this.comPort}`);
    } else {
      this.printerPort = port.toUpperCase();
      logger.info(`USB port set to: ${this.printerPort}`);
    }
  }

  /**
   * Printerni qayta aniqlash
   */
  refresh(): void {
    this.printerPort = null;
    this.comPort = null;
    this.detectPrinter();
  }
}

// Singleton instance
export const printer = new TsplPrinter();
