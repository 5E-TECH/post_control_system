import { Injectable, Scope, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable({ scope: Scope.TRANSIENT })
export class MyLogger {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
  ) {}

  log(context: string, message: string) {
    this.logger.info(message, { context });
  }

  error(context: string, message: string, trace?: string) {
    this.logger.error(message, { context, trace });
  }

  warn(context: string, message: string) {
    this.logger.warn(message, { context });
  }

  debug(context: string, message: string) {
    this.logger.debug(message, { context });
  }
}
