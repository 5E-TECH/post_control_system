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
    // ⚠️ XAVFSIZLIK SHARTI: TypeORM synchronize HECH QACHON true bo'lmasligi kerak.
    // Aks holda ustun tipi o'zgartirilsa, TypeORM DROP+ADD qiladi va PUL/BALANS
    // ma'lumotlari yo'qoladi (oldin shunday bo'lgan: 2026-04-02 incident).
    // Migration ishlatilsin: `npm run migration:run`.
    if (process.env.TYPEORM_SYNCHRONIZE === 'true') {
      console.error(
        "❌ FATAL: TYPEORM_SYNCHRONIZE=true bilan ishga tushirib bo'lmaydi. " +
          'Migration ishlatilsin (npm run migration:run).',
      );
      process.exit(1);
    }
    if (!process.env.NODE_ENV) {
      console.warn(
        "⚠️  NODE_ENV o'rnatilmagan. Production deploy uchun NODE_ENV=production majburiy.",
      );
    }

    // Telegram bot timeout xatoliklari serverni crash qilmasligi uchun
    process.on('unhandledRejection', (reason: any) => {
      const message = reason?.message || String(reason);
      if (
        message.includes('ETIMEDOUT') ||
        message.includes('ECONNREFUSED') ||
        message.includes('getMe')
      ) {
        console.warn(
          `⚠️  Telegram bot ulanish xatosi (server davom etmoqda): ${message}`,
        );
      } else {
        console.error('Unhandled Rejection:', reason);
      }
    });

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
    app.enableCors({
      origin: true,
      credentials: true,
    });

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
              error: "Ma'lumotlar validatsiyadan o'tmadi",
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
