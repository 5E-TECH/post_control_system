import * as fs from 'fs';
import * as path from 'path';
import { Config } from './types';
import { logger } from './logger';
import { MqttPrinterClient } from './mqtt-client';
import { TsplGenerator } from './tspl-generator';
import { printer } from './printer';

/**
 * Beepost Printer Service for Windows
 * MQTT orqali serverdan print buyruqlarini qabul qiladi
 */

// Config faylni o'qish
function loadConfig(): Config {
  const configPaths = [
    path.join(path.dirname(process.execPath), 'config.json'),
    path.join(__dirname, '../config.json'),
    path.join(process.cwd(), 'config.json'),
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        logger.info(`Config loaded from: ${configPath}`);
        return JSON.parse(configData);
      }
    } catch (err) {
      // Continue to next path
    }
  }

  // Default config
  logger.warn('Config file not found, using defaults');
  return {
    mqtt: {
      host: 'mqtt://13.234.20.96:1883',
      username: 'shodiyor',
      password: 'root',
      topic: 'beepost/printer/print',
      reconnectPeriod: 2000,
      connectTimeout: 5000,
    },
    printer: {
      port: 'auto',
    },
    app: {
      name: 'Beepost Printer Service',
      logFile: 'beepost-printer.log',
    },
  };
}

// Asosiy funksiya
async function main(): Promise<void> {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     BEEPOST PRINTER SERVICE v1.0.0        ║');
  console.log('║     Windows Edition                       ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');

  logger.info('Starting Beepost Printer Service...');

  // Config yuklash
  const config = loadConfig();

  // Printer portini sozlash (agar config da berilgan bo'lsa)
  if (config.printer.port && config.printer.port !== 'auto') {
    printer.setPort(config.printer.port);
    logger.info(`Manual port set from config: ${config.printer.port}`);
  }

  // Printer info ko'rsatish
  const printerInfo = printer.getInfo();
  logger.info(`Printer ports - USB: ${printerInfo.usbPort || 'none'}, COM: ${printerInfo.comPort || 'none'}`);

  // MQTT client yaratish va ulash
  const mqttClient = new MqttPrinterClient(config.mqtt);
  mqttClient.connect();

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    mqttClient.disconnect();
    logger.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Status monitoring
  setInterval(() => {
    const status = mqttClient.getQueueStatus();
    if (status.pending > 0 || status.isPrinting) {
      logger.info(`Queue status: ${status.pending} pending, printing: ${status.isPrinting}`);
    }
  }, 30000);

  // Test print (optional - faqat birinchi marta ishga tushganda)
  if (process.argv.includes('--test')) {
    logger.info('Test mode enabled, printing test label...');
    setTimeout(async () => {
      const testLabel = TsplGenerator.generateTestLabel();
      await printer.print(testLabel);
    }, 3000);
  }

  // Keep alive
  logger.info('Service is running. Press Ctrl+C to stop.');
  logger.info(`Listening for print jobs on topic: ${config.mqtt.topic}`);

  // Windows service uchun - process'ni tirik ushlab turish
  await new Promise(() => { }); // Never resolves
}

// Run
main().catch((err) => {
  logger.error('Fatal error:', err.message);
  process.exit(1);
});
