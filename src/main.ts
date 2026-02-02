import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: configService.get('app.frontendUrl'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

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
    .setTitle('Academic Project Platform API')
    .setDescription(
      'The API documentation for the Academic Project Management Platform.\n\n' +
        '## Features\n' +
        '- **Authentication**: JWT-based auth with Access & Refresh tokens.\n' +
        '- **Multi-tenancy**: Support for multiple university departments/tenants.\n' +
        '- **Role-Based Access Control (RBAC)**: Fine-grained permissions for Students, Supervisors, and Admins.\n\n' +
        '## Authentication\n' +
        'Most endpoints require a valid Bearer Token. Use the login endpoint to obtain one.'
    )
    .setVersion('1.0')
    .setContact('Platform Support', 'https://academia.et/support', 'support@academia.et')
    .addTag('Auth', 'Authentication and Session Management')
    .addTag('Health', 'System Health & Diagnostics')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        description: 'Enter your access token here',
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

  // Start server
  const port = configService.get('app.port');
  await app.listen(port);

  console.log(`��� Application is running on: http://localhost:${port}`);
  console.log(
    `��� API: http://localhost:${port}/${configService.get('app.apiPrefix')}/${configService.get('app.apiVersion')}`
  );
  console.log(`��� Environment: ${configService.get('app.nodeEnv')}`);
}

bootstrap();
