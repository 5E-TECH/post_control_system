import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from 'src/infrastructure/lib/exception/all.exception.filter';
import config from 'src/config';
import * as express from 'express';
import { join } from 'path';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

export default class Application {
  public static async main(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

    console.log(join(process.cwd(), 'uploads'));

    app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use(cookieParser());
    app.enableCors({
      origin: '*',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );

    const api = 'api/v1';
    app.setGlobalPrefix(api);
    const config_swagger = new DocumentBuilder()
      .setTitle('Post Control System API')
      .setDescription('A comprehensive API for managing post delivery operations, including orders, users, markets, couriers, and post management')
      .setVersion('1.0.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'Bearer',
        in: 'Header',
        description: 'JWT Authorization header using the Bearer scheme',
      })
      .addTag('Users', 'User management endpoints including authentication, admin, courier, market, and customer operations')
      .addTag('Orders', 'Order management endpoints for creating, tracking, and managing delivery orders')
      .addTag('Posts', 'Post management endpoints for handling delivery posts and courier assignments')
      .addTag('Products', 'Product catalog management')
      .addTag('Regions', 'Geographic region management')
      .addTag('Districts', 'District management within regions')
      .addTag('Cash Box', 'Financial operations and cash management')
      .addTag('Dashboard', 'Dashboard and analytics endpoints')
      .addTag('Bot', 'Telegram bot integration endpoints')
      .setContact('Development Team', '', 'dev@postcontrol.com')
      .setLicense('Private License', '')
      .build();

    const documentFactory = () =>
      SwaggerModule.createDocument(app, config_swagger);
    SwaggerModule.setup(api, app, documentFactory());

    await app.listen(config.PORT, () => {
      const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
      logger.log('info', `Server running on http://localhost:${config.PORT}`);
    });
  }
}
