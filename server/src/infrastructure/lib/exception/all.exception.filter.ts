import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    let error_message = 'Internal server error';
    if (exception instanceof HttpException) {
      const exception_response = exception.getResponse();
      if (typeof exception_response === 'string') {
        error_message = exception_response;
      } else if (
        typeof exception_response === 'object' &&
        exception_response !== null
      ) {
        const message = (exception_response as any).message;

        // Validation errorlari uchun (array formatda keladi)
        if (Array.isArray(message)) {
          // Har bir validation errorni yangi qatorda ko'rsatamiz
          error_message = message.join('. ');
        } else if (typeof message === 'string') {
          error_message = message;
        } else {
          error_message = 'Ma\'lumotlar noto\'g\'ri kiritildi';
        }

        // Agar boshqa validation errors formati bo'lsa
        const validationErrors = (exception_response as any).errors;
        if (validationErrors && Array.isArray(validationErrors)) {
          error_message = validationErrors.join('. ');
        }
      }
    } else if (exception instanceof Error) {
      const message = exception.message || '';

      // Database errorlarni to'g'ri ko'rsatish
      if (message.includes('duplicate key') || message.includes('unique constraint')) {
        error_message = 'Bu ma\'lumot allaqachon mavjud';
      } else if (message.includes('foreign key constraint')) {
        error_message = 'Bog\'langan ma\'lumotlar mavjud, o\'chirish mumkin emas';
      } else if (message.includes('violates not-null constraint')) {
        error_message = 'Majburiy maydonlar to\'ldirilmagan';
      } else if (message.includes('connection') || message.includes('timeout')) {
        error_message = 'Ma\'lumotlar bazasiga ulanishda xatolik';
      } else {
        error_message = message || 'Noma\'lum xatolik yuz berdi';
      }
    }
    const error_response = {
      statusCode: status,
      message: error_message,
      error: error_message, // Compatibility uchun ham qoldiramiz
    };
    response.status(status).json(error_response);
  }
}
