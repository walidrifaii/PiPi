import 'dotenv/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SWAGGER_X_TAG_GROUPS } from './swagger/swagger-tag-groups';
import { SWAGGER_V3_TAG_GROUPS } from './swagger/swagger-v3-tag-groups';
import {
  collectSwaggerTags,
  excludeVersionedSwaggerPaths,
  filterSwaggerPathsByPrefix,
  filterSwaggerTagGroups,
} from './swagger/build-versioned-swagger-document';

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
      'Endpoints are grouped for **Super Admin**, **Merchant**, **Storefront** (public browse), **Customer**, **Delivery**, and **Shared** (auth refresh, app login, health). Use the sections in the Swagger UI sidebar on `/api`. v3-only docs: `/api/v3`.',
    )
    .setVersion('1.0 + 2.0')
    .addBearerAuth()
    .build();

  const fullSwaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const legacySwaggerDocument = excludeVersionedSwaggerPaths(fullSwaggerDocument, [
    '/v2',
    '/v3',
  ]);
  Object.assign(legacySwaggerDocument, { 'x-tagGroups': SWAGGER_X_TAG_GROUPS });
  SwaggerModule.setup('api', app, legacySwaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  });

  const v3SwaggerConfig = new DocumentBuilder()
    .setTitle('Athar API v3')
    .setDescription(
      'v3 API only — saved addresses (max 5), checkout requires addressId, inactive products hidden at checkout. All routes are under `/v3/...`.',
    )
    .setVersion('3.0')
    .addBearerAuth()
    .build();

  const v3FullDocument = SwaggerModule.createDocument(app, v3SwaggerConfig);
  const v3SwaggerDocument = filterSwaggerPathsByPrefix(v3FullDocument, '/v3');
  const v3Tags = collectSwaggerTags(v3SwaggerDocument);
  Object.assign(v3SwaggerDocument, {
    'x-tagGroups': filterSwaggerTagGroups(SWAGGER_V3_TAG_GROUPS, v3Tags),
  });
  SwaggerModule.setup('api/v3', app, v3SwaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
