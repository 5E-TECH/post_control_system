import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from 'src/infrastructure/lib/exception/all.exception.filter';
import config from 'src/config';
import * as express from 'express';
import { join } from 'path';
import { MyLogger } from 'src/logger/logger.service';

export default class Application {
  public static async main(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    // Logger
    app.useLogger(app.get(MyLogger));

    // Uploads static files
    app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

    // Frontend build fayllari (Vite build)
    app.use(express.static(join(process.cwd(), 'public')));

    // Global filters
    app.useGlobalFilters(new AllExceptionsFilter());

    // Cookies va CORS
    app.use(cookieParser());
    app.enableCors({
      origin: '*', // productionda origin ni aniq belgilash tavsiya etiladi
    });

    // Validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );

    // API prefix
    const api = 'api/v1';
    app.setGlobalPrefix(api);

    // Swagger konfiguratsiya
    const config_swagger = new DocumentBuilder()
      .setTitle('Post Control System API')
      .setDescription('API for post delivery management')
      .setVersion('1.0.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'Bearer',
        in: 'Header',
      })
      .build();

    const documentFactory = () =>
      SwaggerModule.createDocument(app, config_swagger);
    SwaggerModule.setup(api, app, documentFactory());

    // Serverni ishga tushirish
    await app.listen(config.PORT, () => {
      const logger = app.get(MyLogger);
      logger.log(
        `Server running on http://localhost:${config.PORT}`,
        'Bootstrap',
      );
    });
  }
}
