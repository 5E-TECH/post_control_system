import { Injectable, Scope, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable({ scope: Scope.TRANSIENT })
export class MyLogger implements LoggerService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  log(message: any, context?: string) {
    this.logger.log(message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, trace, context);
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, context);
  }

  debug?(message: any, context?: string) {
    if (this.logger.debug) {
      this.logger.debug(message, context);
    }
  }

  verbose?(message: any, context?: string) {
    if (this.logger.verbose) {
      this.logger.verbose(message, context);
    }
  }
}
