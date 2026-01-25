/**
 * Offline Queue Service
 *
 * Production-ready offline queue system using IndexedDB
 * Handles network failures, retries, and persistence
 *
 * @author Post Control System
 */

// =============== TYPES ===============
export type OperationType =
  | 'check_post'           // Pochta tekshirish (post-scanner)
  | 'receive_order'        // Buyurtma qabul qilish (global-scanner)
  | 'check_refused_post';  // Bekor qilingan pochta tekshirish

export interface QueuedOperation {
  id: string;
  type: OperationType;
  payload: {
    token: string;
    contextId: string;  // postId or marketId
    additionalData?: any;
  };
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: number | null;
  lastError: string | null;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

export interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  total: number;
}

type StatusChangeCallback = (stats: QueueStats) => void;
type OperationResultCallback = (
  operation: QueuedOperation,
  success: boolean,
  result?: any,
  error?: string
) => void;

// =============== CONSTANTS ===============
const DB_NAME = 'post_control_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'operations';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 2000; // 2 seconds

// =============== INDEXEDDB HELPERS ===============
let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

async function openDatabase(): Promise<IDBDatabase> {
  // Singleton pattern - bir marta ochiladi
  if (dbInstance) {
    return dbInstance;
  }

  // Agar allaqachon ochilayotgan bo'lsa, kutamiz
  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineQueue] Database error:', request.error);
      dbInitPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle database close (tab closed, etc.)
      dbInstance.onclose = () => {
        dbInstance = null;
        dbInitPromise = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Operations store yaratish
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });

  return dbInitPromise;
}

// =============== OFFLINE QUEUE SERVICE CLASS ===============
class OfflineQueueService {
  private statusChangeCallbacks: Set<StatusChangeCallback> = new Set();
  private operationResultCallbacks: Set<OperationResultCallback> = new Set();
  private isProcessing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private processingPromise: Promise<void> | null = null;

  constructor() {
    // Network status listener
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  // =============== NETWORK HANDLERS ===============
  private handleOnline = () => {
    this.isOnline = true;
    console.log('[OfflineQueue] Network restored');
    // Avtomatik navbatni qayta ishlash
    this.processQueue();
  };

  private handleOffline = () => {
    this.isOnline = false;
    console.log('[OfflineQueue] Network lost');
  };

  // =============== CALLBACK MANAGEMENT ===============
  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.add(callback);
    return () => this.statusChangeCallbacks.delete(callback);
  }

  onOperationResult(callback: OperationResultCallback): () => void {
    this.operationResultCallbacks.add(callback);
    return () => this.operationResultCallbacks.delete(callback);
  }

  private async notifyStatusChange(): Promise<void> {
    const stats = await this.getStats();
    this.statusChangeCallbacks.forEach(cb => {
      try {
        cb(stats);
      } catch (e) {
        console.error('[OfflineQueue] Status callback error:', e);
      }
    });
  }

  private notifyOperationResult(
    operation: QueuedOperation,
    success: boolean,
    result?: any,
    error?: string
  ): void {
    this.operationResultCallbacks.forEach(cb => {
      try {
        cb(operation, success, result, error);
      } catch (e) {
        console.error('[OfflineQueue] Result callback error:', e);
      }
    });
  }

  // =============== QUEUE OPERATIONS ===============

  /**
   * Yangi operatsiyani navbatga qo'shish
   */
  async addToQueue(
    type: OperationType,
    token: string,
    contextId: string,
    additionalData?: any
  ): Promise<QueuedOperation> {
    const db = await openDatabase();

    // Unique ID yaratish
    const id = `${type}_${token}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const operation: QueuedOperation = {
      id,
      type,
      payload: {
        token,
        contextId,
        additionalData
      },
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      lastAttemptAt: null,
      lastError: null,
      status: 'pending'
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(operation);

      request.onsuccess = () => {
        console.log(`[OfflineQueue] Added: ${type} - ${token}`);
        this.notifyStatusChange();
        resolve(operation);

        // Navbatni qayta ishlashni boshlash
        if (this.isOnline) {
          this.processQueue();
        }
      };

      request.onerror = () => {
        console.error('[OfflineQueue] Add error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Operatsiyani yangilash
   */
  private async updateOperation(operation: QueuedOperation): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(operation);

      request.onsuccess = () => {
        this.notifyStatusChange();
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Operatsiyani o'chirish
   */
  async removeOperation(id: string): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.notifyStatusChange();
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Barcha pending operatsiyalarni olish
   */
  async getPendingOperations(): Promise<QueuedOperation[]> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        // createdAt bo'yicha saralash (eng eski birinchi)
        const operations = (request.result as QueuedOperation[])
          .sort((a, b) => a.createdAt - b.createdAt);
        resolve(operations);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Barcha failed operatsiyalarni olish
   */
  async getFailedOperations(): Promise<QueuedOperation[]> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('failed');

      request.onsuccess = () => {
        resolve(request.result as QueuedOperation[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Statistika olish
   */
  async getStats(): Promise<QueueStats> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const operations = request.result as QueuedOperation[];
        const stats: QueueStats = {
          pending: operations.filter(op => op.status === 'pending').length,
          processing: operations.filter(op => op.status === 'processing').length,
          failed: operations.filter(op => op.status === 'failed').length,
          total: operations.length
        };
        resolve(stats);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Token allaqachon navbatda bormi tekshirish
   */
  async isTokenInQueue(token: string, type: OperationType): Promise<boolean> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const operations = request.result as QueuedOperation[];
        const exists = operations.some(
          op => op.payload.token === token &&
               op.type === type &&
               (op.status === 'pending' || op.status === 'processing')
        );
        resolve(exists);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Failed operatsiyani qayta urinish uchun pending ga o'tkazish
   */
  async retryOperation(id: string): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const operation = getRequest.result as QueuedOperation;
        if (!operation) {
          reject(new Error('Operation not found'));
          return;
        }

        operation.status = 'pending';
        operation.attempts = 0;
        operation.lastError = null;

        const putRequest = store.put(operation);
        putRequest.onsuccess = () => {
          this.notifyStatusChange();
          resolve();
          // Navbatni qayta ishlash
          if (this.isOnline) {
            this.processQueue();
          }
        };
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Barcha failed operatsiyalarni qayta urinish
   */
  async retryAllFailed(): Promise<void> {
    const failed = await this.getFailedOperations();
    for (const op of failed) {
      await this.retryOperation(op.id);
    }
  }

  /**
   * Barcha failed operatsiyalarni o'chirish
   */
  async clearAllFailed(): Promise<void> {
    const failed = await this.getFailedOperations();
    for (const op of failed) {
      await this.removeOperation(op.id);
    }
  }

  /**
   * Butun navbatni tozalash
   */
  async clearAll(): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        this.notifyStatusChange();
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // =============== QUEUE PROCESSING ===============

  /**
   * Navbatni qayta ishlash
   * Bu method executor funksiyasini oladi va operatsiyalarni bajaradi
   */
  async processQueue(
    executor?: (operation: QueuedOperation) => Promise<any>
  ): Promise<void> {
    // Agar allaqachon ishlayotgan bo'lsa, kutamiz
    if (this.isProcessing) {
      if (this.processingPromise) {
        await this.processingPromise;
      }
      return;
    }

    // Internet yo'q bo'lsa, qaytamiz
    if (!this.isOnline) {
      console.log('[OfflineQueue] Offline - skipping processing');
      return;
    }

    this.isProcessing = true;

    this.processingPromise = (async () => {
      try {
        const pending = await this.getPendingOperations();

        if (pending.length === 0) {
          return;
        }

        console.log(`[OfflineQueue] Processing ${pending.length} operations`);

        for (const operation of pending) {
          // Internet tekshirish
          if (!this.isOnline) {
            console.log('[OfflineQueue] Lost connection during processing');
            break;
          }

          // Operatsiyani processing ga o'tkazish
          operation.status = 'processing';
          operation.attempts += 1;
          operation.lastAttemptAt = Date.now();
          await this.updateOperation(operation);

          try {
            let result: any;

            // Agar executor berilgan bo'lsa, ishlatamiz
            if (executor) {
              result = await executor(operation);
            } else {
              // Default - faqat operatsiyani completed ga o'tkazamiz
              // Real executor hook tomonidan beriladi
              console.log(`[OfflineQueue] No executor for: ${operation.type}`);
              operation.status = 'pending';
              await this.updateOperation(operation);
              continue;
            }

            // Muvaffaqiyatli - operatsiyani o'chirish
            await this.removeOperation(operation.id);
            this.notifyOperationResult(operation, true, result);

            console.log(`[OfflineQueue] Completed: ${operation.type} - ${operation.payload.token}`);

          } catch (error: any) {
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            operation.lastError = errorMessage;

            // Max urinishlardan oshgan bo'lsa, failed ga o'tkazish
            if (operation.attempts >= operation.maxAttempts) {
              operation.status = 'failed';
              console.error(`[OfflineQueue] Failed after ${operation.attempts} attempts: ${operation.payload.token}`);
            } else {
              operation.status = 'pending';
              console.warn(`[OfflineQueue] Retry later (${operation.attempts}/${operation.maxAttempts}): ${operation.payload.token}`);
            }

            await this.updateOperation(operation);
            this.notifyOperationResult(operation, false, undefined, errorMessage);

            // Retry delay
            const delay = RETRY_DELAY_BASE * operation.attempts;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } finally {
        this.isProcessing = false;
        this.processingPromise = null;
      }
    })();

    await this.processingPromise;
  }

  /**
   * Online holatini olish
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Serviceni to'xtatish (cleanup)
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.statusChangeCallbacks.clear();
    this.operationResultCallbacks.clear();
  }
}

// =============== SINGLETON EXPORT ===============
export const offlineQueueService = new OfflineQueueService();

// Named export for testing
export { OfflineQueueService };
