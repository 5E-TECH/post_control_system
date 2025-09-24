import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { Logger as WinstonLogger } from 'winston';

@Injectable()
export class MyLogger {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: WinstonLogger,
  ) {}

  // Nest LoggerService interfeysiga mos
  log(message: any, context?: string) {
    try {
      // Winston. info() mavjud bo‘lishi kerak
      if (this.logger && typeof this.logger.info === 'function') {
        this.logger.info(String(message), { context });
      } else if (this.logger && typeof this.logger.log === 'function') {
        this.logger.log('info', String(message), { context });
      } else {
        // fallback
        console.log(`[${context || 'App'}] ${message}`);
      }
    } catch (err) {
      console.log('MyLogger.log fallback:', err);
    }
  }

  error(message: any, trace?: string, context?: string) {
    try {
      if (this.logger && typeof this.logger.error === 'function') {
        this.logger.error(String(message), { context, trace });
      } else if (this.logger && typeof this.logger.log === 'function') {
        this.logger.log('error', String(message), { context, trace });
      } else {
        console.error(`[${context || 'App'}] ERROR:`, message, trace);
      }
    } catch (err) {
      console.error('MyLogger.error fallback:', err);
    }
  }

  warn(message: any, context?: string) {
    try {
      if (this.logger && typeof this.logger.warn === 'function') {
        this.logger.warn(String(message), { context });
      } else if (this.logger && typeof this.logger.log === 'function') {
        this.logger.log('warn', String(message), { context });
      } else {
        console.warn(`[${context || 'App'}] WARN:`, message);
      }
    } catch (err) {
      console.warn('MyLogger.warn fallback:', err);
    }
  }

  debug?(message: any, context?: string) {
    try {
      if (this.logger && typeof this.logger.debug === 'function') {
        this.logger.debug(String(message), { context });
      } else if (this.logger && typeof this.logger.log === 'function') {
        this.logger.log('debug', String(message), { context });
      } else {
        console.debug(`[${context || 'App'}] DEBUG:`, message);
      }
    } catch (err) {
      console.debug('MyLogger.debug fallback:', err);
    }
  }

  verbose?(message: any, context?: string) {
    try {
      if (this.logger && typeof this.logger.verbose === 'function') {
        this.logger.verbose(String(message), { context });
      } else if (this.logger && typeof this.logger.log === 'function') {
        this.logger.log('verbose', String(message), { context });
      } else {
        console.log(`[${context || 'App'}] VERBOSE:`, message);
      }
    } catch (err) {
      console.log('MyLogger.verbose fallback:', err);
    }
  }
}
