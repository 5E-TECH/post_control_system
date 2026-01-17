import * as mqtt from 'mqtt';
import { MqttConfig, PrintOrder } from './types';
import { logger } from './logger';
import { TsplGenerator } from './tspl-generator';
import { printer } from './printer';

/**
 * MQTT Client - serverdan kelgan print buyruqlarni qabul qiladi
 */
export class MqttPrinterClient {
  private client: mqtt.MqttClient | null = null;
  private config: MqttConfig;
  private printQueue: string[] = [];
  private isPrinting: boolean = false;

  constructor(config: MqttConfig) {
    this.config = config;
  }

  /**
   * MQTT serverga ulanish
   */
  connect(): void {
    logger.info(`Connecting to MQTT server: ${this.config.host}`);

    this.client = mqtt.connect(this.config.host, {
      username: this.config.username,
      password: this.config.password,
      reconnectPeriod: this.config.reconnectPeriod,
      connectTimeout: this.config.connectTimeout,
    });

    this.client.on('connect', () => {
      logger.success('Connected to MQTT server');
      this.subscribe();
    });

    this.client.on('error', (err) => {
      logger.error('MQTT error:', err.message);
    });

    this.client.on('close', () => {
      logger.warn('MQTT connection closed');
    });

    this.client.on('reconnect', () => {
      logger.info('Reconnecting to MQTT server...');
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message.toString());
    });
  }

  /**
   * Topic ga obuna bo'lish
   */
  private subscribe(): void {
    if (!this.client) return;

    this.client.subscribe(this.config.topic, (err) => {
      if (err) {
        logger.error(`Subscribe error for topic ${this.config.topic}:`, err.message);
      } else {
        logger.success(`Subscribed to topic: ${this.config.topic}`);
      }
    });
  }

  /**
   * Kelgan xabarni qayta ishlash
   */
  private handleMessage(topic: string, message: string): void {
    logger.info(`Received message on topic: ${topic}`);

    try {
      // TSPL command to'g'ridan-to'g'ri keladi
      // Server tomonidan generatsiya qilingan
      if (message.includes('SIZE') && message.includes('PRINT')) {
        // Bu TSPL command
        logger.info('Received TSPL command, adding to queue');
        this.addToQueue(message);
      } else {
        // JSON format bo'lishi mumkin
        try {
          const data = JSON.parse(message);

          if (Array.isArray(data)) {
            // Bir nechta order
            for (const order of data) {
              const tspl = TsplGenerator.generate(order as PrintOrder);
              this.addToQueue(tspl);
            }
          } else if (data.orderId) {
            // Bitta order
            const tspl = TsplGenerator.generate(data as PrintOrder);
            this.addToQueue(tspl);
          } else {
            logger.warn('Unknown message format');
          }
        } catch (jsonErr) {
          // JSON emas, TSPL command sifatida ishlaymiz
          this.addToQueue(message);
        }
      }
    } catch (err: any) {
      logger.error('Message handling error:', err.message);
    }
  }

  /**
   * Print queue ga qo'shish
   */
  private addToQueue(tsplCommand: string): void {
    this.printQueue.push(tsplCommand);
    logger.info(`Added to queue. Queue length: ${this.printQueue.length}`);
    this.processQueue();
  }

  /**
   * Queue ni qayta ishlash
   */
  private async processQueue(): Promise<void> {
    if (this.isPrinting || this.printQueue.length === 0) {
      return;
    }

    this.isPrinting = true;

    while (this.printQueue.length > 0) {
      const command = this.printQueue.shift();
      if (!command) continue;

      try {
        logger.info('Processing print job...');
        await printer.print(command);

        // Keyingi print uchun kutish (printer tayyorlanishi uchun)
        await this.delay(3000);
      } catch (err: any) {
        logger.error('Print job failed:', err.message);
      }
    }

    this.isPrinting = false;
    logger.info('Queue processing completed');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * MQTT ulanishni yopish
   */
  disconnect(): void {
    if (this.client) {
      this.client.end();
      logger.info('MQTT client disconnected');
    }
  }

  /**
   * Ulanish holatini tekshirish
   */
  isConnected(): boolean {
    return this.client?.connected || false;
  }

  /**
   * Queue holatini olish
   */
  getQueueStatus(): { pending: number; isPrinting: boolean } {
    return {
      pending: this.printQueue.length,
      isPrinting: this.isPrinting,
    };
  }
}
