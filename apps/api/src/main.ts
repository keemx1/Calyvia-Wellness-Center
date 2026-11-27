import * as dotenv from 'dotenv';
import * as path from 'path';

// Local development convenience only. Production secrets must come from the
// deployment environment (Coolify/Docker), never a file bundled with the app.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // Baileys (WhatsApp socket) is known for occasional unhandled rejections on
  // connection churn. Log them instead of letting Node's default behavior kill
  // the whole API process.
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[unhandledRejection]', reason);
  });

  // Passport photos arrive as base64 JSON; the Express default (100 KB) is
  // too small for a 5 MB image, so parse bodies here with an explicit limit.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Security middlewares
  app.use(helmet());
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefixes and filters
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Calyvia Wellness Center Management System API')
    .setDescription(
      'Production HMIS/EMR REST API for Calyvia Wellness Center (Ruiru, Kenya). Covers all 28 clinical, operational, and financial domains.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[Calyvia API] Server listening on http://localhost:${port}/api/v1`);
  console.log(`[Calyvia API] Swagger documentation ready at http://localhost:${port}/api/docs`);
}

bootstrap();
