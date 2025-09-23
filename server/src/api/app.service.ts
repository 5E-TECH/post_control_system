import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
// import { AppModule } from 'src/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from 'src/infrastructure/lib/exception/all.exception.filter';
import config from 'src/config';
import * as express from 'express';
import { join } from 'path';
import { MyLogger } from 'src/logger/logger.service';
import { AppModule } from './app.module';

export default class Application {
  public static async main(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    // Logger — singleton MyLogger ni bir martta oling
    const myLogger = app.get(MyLogger);
    app.useLogger(myLogger);

    // Static files
    app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
    app.use(express.static(join(process.cwd(), 'public')));

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
