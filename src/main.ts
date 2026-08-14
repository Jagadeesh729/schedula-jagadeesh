import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET ||
      process.env.JWT_SECRET === 'supersecretkey' ||
      process.env.JWT_SECRET === 'super_secret_key_for_jwt')
  ) {
    Logger.error(
      'FATAL: Production JWT_SECRET environment variable is unset or insecure.',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  // Enable express proxy trust for rate limiter X-Forwarded-For header validation
  const expressApp = app.getHttpAdapter().getInstance() as {
    set?: (setting: string, val: boolean) => void;
  };
  if (expressApp && typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', true);
  }

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // Configure OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Schedula Enterprise Medical Appointment API')
    .setDescription(
      'Production-grade Medical Appointment Scheduling & Elastic Availability Engine built with NestJS, TypeScript, and PostgreSQL',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
