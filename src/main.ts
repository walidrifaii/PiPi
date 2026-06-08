import 'dotenv/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SWAGGER_X_TAG_GROUPS } from './swagger/swagger-tag-groups';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', true);
  }

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:63237',
      'https://delivery-web-ebon.vercel.app',
      'https://pip-pip-delivery.com',
      'http://localhost:52855',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Athar API')
    .setDescription(
      'Endpoints are grouped for **Super Admin**, **Merchant**, **Storefront** (public browse), **Customer**, **Delivery**, and **Shared** (auth refresh, app login, health). Use the sections in the Swagger UI sidebar on `/api`.',
    )
    .setVersion('1.0 + 2.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  Object.assign(swaggerDocument, { 'x-tagGroups': SWAGGER_X_TAG_GROUPS });
  SwaggerModule.setup('api', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
