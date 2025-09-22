import { Injectable, Scope, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable({ scope: Scope.TRANSIENT })
export class MyLogger {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  log(context: string, message: string) {
    this.logger.log(message, { context });
  }

  error(context: string, message: string, trace?: string) {
    this.logger.error(message, { context, trace });
  }

  warn(context: string, message: string) {
    this.logger.warn(message, { context });
  }
}
