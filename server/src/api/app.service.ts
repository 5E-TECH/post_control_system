import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe, HttpException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from 'src/infrastructure/lib/exception/all.exception.filter';
import config from 'src/config';
import * as express from 'express';
import { MyLogger } from 'src/logger/logger.service';
import { AppModule } from './app.module';

export default class Application {
  public static async main(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    // Logger chiqadi
    const myLogger = app.get(MyLogger);
    app.useLogger(myLogger);

    // ✅ Body size limit (katta JSON payloadlar uchun - external orders)
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // ✅ Static files (uploads)
    const uploadDir = 'home/ubuntu/uploads';
    app.use('/uploads', express.static(uploadDir));

    // Public folder (agar bo'lsa)
    app.use(express.static('public'));

    // Global filters, pipes, cors
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use(cookieParser());
    app.enableCors({ origin: '*' });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true, // DTO ga avtomatik transform qilish
        exceptionFactory: (errors) => {
          // Validation errorlarini tushunarli formatga o'tkazamiz
          const messages = errors.map((error) => {
            const constraints = error.constraints || {};
            // Barcha constraint messagelarni olib, birinchisini qaytaramiz
            const constraintMessages = Object.values(constraints);
            return constraintMessages.length > 0
              ? constraintMessages.join(', ')
              : `${error.property} - noto'g'ri qiymat`;
          });

          return new HttpException(
            {
              statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
              message: messages,
              error: 'Ma\'lumotlar validatsiyadan o\'tmadi',
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        },
      }),
    );

    // Prefix & Swagger
    const api = 'api/v1';
    app.setGlobalPrefix(api);

    const config_swagger = new DocumentBuilder()
      .setTitle('Post Control System API')
      .setDescription('API for post delivery management')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const documentFactory = () =>
      SwaggerModule.createDocument(app, config_swagger);
    SwaggerModule.setup(api, app, documentFactory());

    // Start
    await app.listen(config.PORT);
    myLogger.log(
      `🚀 Server running on http://localhost:${config.PORT}`,
      'Bootstrap',
    );
  }
}
