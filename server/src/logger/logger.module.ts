import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { transports, format } from 'winston';
import { MyLogger } from './logger.service';

@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.printf(({ timestamp, level, message, context, ms }) => {
          return `[${timestamp}] ${level} [${context || 'NestApp'}]: ${message} ${ms || ''}`;
        }),
      ),
      transports: [
        // Console uchun
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message, context }) => {
              return `[${timestamp}] ${level} [${context || 'NestApp'}]: ${message}`;
            }),
          ),
        }),
        // Faqat errorlar
        new transports.File({
          filename: 'logs/app-error.log',
          level: 'error',
        }),
        // Barcha info va undan yuqori darajadagi loglar
        new transports.File({
          filename: 'logs/app-combined.log',
          level: 'info',
        }),
      ],
    }),
  ],
  providers: [MyLogger],
  exports: [MyLogger],
})
export class LoggerModule {}
