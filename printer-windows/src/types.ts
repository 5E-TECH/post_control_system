/**
 * Print order interface - server bilan bir xil
 */
export interface PrintOrder {
  orderId: string;
  orderPrice: string;
  operator: string;
  customerName: string;
  customerPhone: string;
  extraNumber: string;
  market: string;
  comment: string;
  region: string;
  district: string;
  address: string;
  qrCode: string;
  created_time: string;
  whereDeliver: string;
  items: {
    product: string;
    quantity: number;
  }[];
}

/**
 * MQTT config
 */
export interface MqttConfig {
  host: string;
  username: string;
  password: string;
  topic: string;
  reconnectPeriod: number;
  connectTimeout: number;
}

/**
 * Printer config
 */
export interface PrinterConfig {
  port: string; // "auto", "COM3", "USB001", etc.
}

/**
 * App config
 */
export interface AppConfig {
  name: string;
  logFile: string;
}

/**
 * Full config
 */
export interface Config {
  mqtt: MqttConfig;
  printer: PrinterConfig;
  app: AppConfig;
}
