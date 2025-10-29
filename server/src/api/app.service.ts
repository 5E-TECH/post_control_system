import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
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

    // Logger
    const myLogger = app.get(MyLogger);
    app.useLogger(myLogger);

    // ✅ Static files (uploads)
    const uploadDir = config.UPLOAD_URL
    app.use('/uploads', express.static(uploadDir));

    // Public folder (agar bo‘lsa)
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
