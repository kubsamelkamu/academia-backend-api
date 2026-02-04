import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import helmet from 'helmet';
import * as compression from 'compression';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  if (process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance()?.set?.('trust proxy', 1);
  }

  app.use(helmet());
  const frontendUrl = configService.get<string>('app.frontendUrl');
  const allowedOrigins = new Set(
    [frontendUrl, 'http://localhost:3000', 'http://localhost:3001'].filter(Boolean)
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  } as CorsOptions);

  // Performance
  app.use(compression());

  // Global prefix
  app.setGlobalPrefix(configService.get('app.apiPrefix') ?? 'api');

  // Versioning
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Swagger (OpenAPI)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Academia API')
    .setDescription(
      'API documentation for Academia (Academic Project Management Platform).\n\n' +
        '## Overview\n' +
        '- **Authentication**: JWT Access & Refresh tokens.\n' +
        '- **Admins**: Dedicated admin endpoints under `/api/v1/admin/*` (RBAC protected).\n' +
        '- **Multi-tenancy**: Tenant-aware resources and access control.\n' +
        '- **Storage**: Avatar uploads via Cloudinary.\n\n' +
        '## Authentication\n' +
        'Most endpoints require an `Authorization: Bearer <access_token>` header. Use the login endpoints to obtain tokens.'
    )
    .setVersion('1.0')
    .setContact('Academia Support', 'https://academia.et/support', 'support@academia.et')
    .addTag('Auth', 'Authentication and Session Management')
    .addTag('Admin Auth', 'Admin authentication, 2FA, and sessions')
    .addTag('Admin Profile', 'Admin profile and avatar management')
    .addTag('Health', 'System Health & Diagnostics')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        description: 'Paste your access token here',
      },
      'access-token'
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Standard API response shapes
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Start server
  const port = configService.get('app.port');
  await app.listen(port);
}

bootstrap();
