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
        format.ms(),
        format.errors({ stack: true }),
        format.splat(),
        format.printf(({ level, message, timestamp, context, ms }) => {
          return `[${timestamp}] ${level} [${context || 'NestApp'}]: ${message} ${ms || ''}`;
        }),
      ),
      transports: [
        // Console transport
        new transports.Console({
          format: format.combine(
            format.colorize({ all: true }),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.ms(),
            format.printf(({ level, message, timestamp, context, ms }) => {
              return `[${timestamp}] ${level} [${context || 'NestApp'}]: ${message} ${ms || ''}`;
            }),
          ),
        }),

        // Faqat errorlarni yozish
        new transports.File({
          filename: 'logs/app-error.log',
          level: 'error',
        }),

        // Barcha loglarni yozish (info va undan yuqori)
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
