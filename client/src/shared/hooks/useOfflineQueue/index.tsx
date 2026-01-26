/**
 * useOfflineQueue Hook
 *
 * React hook for using the offline queue service
 * Provides queue management, status tracking, and API execution
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import {
  offlineQueueService,
  type QueuedOperation,
  type QueueStats,
  type OperationType
} from '../../services/offline-queue';
import { usePost } from '../../api/hooks/usePost';
import { useOrder } from '../../api/hooks/useOrder';

// =============== TYPES ===============
interface UseOfflineQueueOptions {
  autoProcess?: boolean;  // Avtomatik navbatni qayta ishlash
  showMessages?: boolean; // Antd message ko'rsatish
  operationType: OperationType;
  contextId: string;      // postId yoki marketId
}

interface UseOfflineQueueReturn {
  // State
  stats: QueueStats;
  isOnline: boolean;
  isProcessing: boolean;
  failedOperations: QueuedOperation[];

  // Actions
  addToQueue: (token: string, additionalData?: any) => Promise<boolean>;
  processQueue: () => Promise<void>;
  retryOperation: (id: string) => Promise<void>;
  retryAllFailed: () => Promise<void>;
  clearAllFailed: () => Promise<void>;
  isTokenInQueue: (token: string) => Promise<boolean>;
}

// =============== SOUND UTILITIES ===============
const BASE_URL = import.meta.env.BASE_URL || '/';

// Preload audio for faster playback
let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;

// Initialize audio on first import
if (typeof window !== 'undefined') {
  try {
    successAudio = new Audio(`${BASE_URL}sound/beep.mp3`);
    successAudio.volume = 0.6;
    successAudio.load();

    errorAudio = new Audio(`${BASE_URL}sound/error.mp3`);
    errorAudio.volume = 1.0; // Maksimal ovoz xatolik uchun
    errorAudio.load();
  } catch {
    // Audio init error - ignore
  }
}

const playSuccessSound = () => {
  try {
    if (successAudio) {
      successAudio.currentTime = 0;
      successAudio.play().catch(() => {});
    } else {
      const audio = new Audio(`${BASE_URL}sound/beep.mp3`);
      audio.volume = 0.6;
      audio.play().catch(() => {});
    }
  } catch {
    // Sound error - ignore
  }
};

const playErrorSound = () => {
  try {
    if (errorAudio) {
      errorAudio.currentTime = 0;
      errorAudio.play().catch(() => {});
    } else {
      const audio = new Audio(`${BASE_URL}sound/error.mp3`);
      audio.volume = 1.0;
      audio.play().catch(() => {});
    }
  } catch {
    // Sound error - ignore
  }
};

// =============== HOOK ===============
export function useOfflineQueue(options: UseOfflineQueueOptions): UseOfflineQueueReturn {
  const {
    autoProcess = true,
    showMessages = true,
    operationType,
    contextId
  } = options;

  // State
  const [stats, setStats] = useState<QueueStats>({
    pending: 0,
    processing: 0,
    failed: 0,
    total: 0
  });
  const [isOnline, setIsOnline] = useState(offlineQueueService.getOnlineStatus());
  const [isProcessing, setIsProcessing] = useState(false);
  const [failedOperations, setFailedOperations] = useState<QueuedOperation[]>([]);

  // API hooks
  const { checkPost, checkRefusedPost } = usePost();
  const { receiveOrderByScanerById } = useOrder();

  // Refs for stable callbacks
  const contextIdRef = useRef(contextId);
  contextIdRef.current = contextId;

  // =============== API EXECUTOR ===============
  const executeOperation = useCallback(async (operation: QueuedOperation): Promise<any> => {
    const { type, payload } = operation;
    const { token, contextId: opContextId } = payload;

    switch (type) {
      case 'check_post':
        return new Promise((resolve, reject) => {
          checkPost.mutate(
            { id: token, data: { postId: opContextId } },
            {
              onSuccess: (res) => resolve(res),
              onError: (err) => reject(err)
            }
          );
        });

      case 'check_refused_post':
        return new Promise((resolve, reject) => {
          checkRefusedPost.mutate(
            { id: token, data: { postId: opContextId } },
            {
              onSuccess: (res) => resolve(res),
              onError: (err) => reject(err)
            }
          );
        });

      case 'receive_order':
        return receiveOrderByScanerById.mutateAsync({
          id: token,
          data: { marketId: opContextId }
        });

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }, [checkPost, checkRefusedPost, receiveOrderByScanerById]);

  // =============== CALLBACKS ===============

  // Stats yangilash
  const updateStats = useCallback(async () => {
    try {
      const newStats = await offlineQueueService.getStats();
      setStats(newStats);

      const failed = await offlineQueueService.getFailedOperations();
      setFailedOperations(failed.filter(op => op.type === operationType));
    } catch (error) {
      console.error('[useOfflineQueue] Stats update error:', error);
    }
  }, [operationType]);

  // Navbatga qo'shish
  const addToQueue = useCallback(async (token: string, additionalData?: any): Promise<boolean> => {
    // Token allaqachon navbatda bormi?
    const exists = await offlineQueueService.isTokenInQueue(token, operationType);
    if (exists) {
      if (showMessages) {
        playErrorSound();
        message.warning({ content: `${token} allaqachon navbatda`, key: token });
      }
      return false;
    }

    try {
      await offlineQueueService.addToQueue(
        operationType,
        token,
        contextIdRef.current,
        additionalData
      );

      if (showMessages) {
        if (!isOnline) {
          message.info({ content: `Offline - keyinroq tekshiriladi`, key: token, duration: 2 });
        } else {
          message.loading({ content: `Tekshirilmoqda...`, key: token, duration: 0 });
        }
      }

      return true;
    } catch (error) {
      console.error('[useOfflineQueue] Add error:', error);
      if (showMessages) {
        playErrorSound();
        message.error({ content: 'Navbatga qo\'shishda xatolik', key: token });
      }
      return false;
    }
  }, [operationType, showMessages, isOnline]);

  // Navbatni qayta ishlash
  const processQueue = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      await offlineQueueService.processQueue(executeOperation);
    } catch (error) {
      console.error('[useOfflineQueue] Process error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [executeOperation, isProcessing]);

  // Bitta operatsiyani qayta urinish
  const retryOperation = useCallback(async (id: string) => {
    try {
      await offlineQueueService.retryOperation(id);
      if (showMessages) {
        message.loading({ content: 'Qayta urinilmoqda...', key: id });
      }
    } catch (error) {
      console.error('[useOfflineQueue] Retry error:', error);
    }
  }, [showMessages]);

  // Barcha failed ni qayta urinish
  const retryAllFailed = useCallback(async () => {
    try {
      await offlineQueueService.retryAllFailed();
      if (showMessages) {
        message.loading({ content: `${failedOperations.length} ta qayta urinilmoqda...`, key: 'retry-all' });
      }
    } catch (error) {
      console.error('[useOfflineQueue] Retry all error:', error);
    }
  }, [showMessages, failedOperations.length]);

  // Barcha failed ni o'chirish
  const clearAllFailed = useCallback(async () => {
    try {
      await offlineQueueService.clearAllFailed();
      if (showMessages) {
        message.info('Muvaffaqiyatsiz operatsiyalar tozalandi');
      }
    } catch (error) {
      console.error('[useOfflineQueue] Clear error:', error);
    }
  }, [showMessages]);

  // Token navbatda bormi
  const isTokenInQueue = useCallback(async (token: string): Promise<boolean> => {
    return offlineQueueService.isTokenInQueue(token, operationType);
  }, [operationType]);

  // =============== EFFECTS ===============

  // Service callbacks
  useEffect(() => {
    // Stats callback
    const unsubStats = offlineQueueService.onStatusChange((newStats) => {
      setStats(newStats);
      // Failed operatsiyalarni yangilash
      offlineQueueService.getFailedOperations().then(failed => {
        setFailedOperations(failed.filter(op => op.type === operationType));
      });
    });

    // Operation result callback
    const unsubResult = offlineQueueService.onOperationResult(
      (operation, success, _result, error) => {
        // Faqat o'zimizning operatsiyalarimizni ko'rsatamiz
        if (operation.type !== operationType) return;

        if (success) {
          playSuccessSound();
          if (showMessages) {
            message.success({
              content: `✓ Topildi!`,
              key: operation.payload.token,
              duration: 1.5
            });
          }
        } else {
          // Failed operatsiyalar uchun darhol xabar
          if (operation.status === 'failed') {
            playErrorSound();
            if (showMessages) {
              // Xatolik xabarini foydalanuvchiga tushunarli qilish
              let errorText = 'Xatolik';
              const errLower = (error || '').toLowerCase();

              if (errLower.includes('not found') || errLower.includes('topilmadi')) {
                errorText = 'Bu pochtada mavjud emas!';
              } else if (errLower.includes('bad request') || errLower.includes('validation')) {
                errorText = 'Noto\'g\'ri ma\'lumot';
              } else if (error) {
                errorText = error;
              }

              message.error({
                content: `✗ ${errorText}`,
                key: operation.payload.token,
                duration: 2
              });
            }
          }
        }
      }
    );

    // Initial stats
    updateStats();

    return () => {
      unsubStats();
      unsubResult();
    };
  }, [operationType, showMessages, updateStats]);

  // Network status tracking
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (showMessages) {
        message.success('Internet qayta ulandi!');
      }
      // Auto process
      if (autoProcess) {
        processQueue();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (showMessages) {
        message.warning('Internet uzildi! Skanlar saqlanadi...');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoProcess, processQueue, showMessages]);

  // Auto process on mount
  useEffect(() => {
    if (autoProcess && isOnline) {
      processQueue();
    }
  }, [autoProcess, isOnline]); // processQueue ni dependency dan chiqardik - bu qayta render chaqirishni oldini oladi

  return {
    stats,
    isOnline,
    isProcessing,
    failedOperations,
    addToQueue,
    processQueue,
    retryOperation,
    retryAllFailed,
    clearAllFailed,
    isTokenInQueue
  };
}

// =============== EXPORTS ===============
export type { UseOfflineQueueOptions, UseOfflineQueueReturn };
