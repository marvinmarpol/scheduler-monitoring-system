import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);

  const environment = configService.get<string>('NODE_ENV', 'local');
  if (environment === 'production') {
    return;
  }

  const appVersion = configService.get<string>('APP_VERSION', '1.0.0');
  const cookieName = environment === 'staging' ? 'SUPERZOOSTAGINGSID' : 'SUPERZOOLOCALSID';
  const swaggerPath = 'api/docs';
  const jsonDocumentUrl = `${swaggerPath}/spec/json`;
  const yamlDocumentUrl = `${swaggerPath}/spec/yaml`;

  const config = new DocumentBuilder()
    .setTitle('Scheduler Monitoring System')
    .setDescription(
      'Centralized monitoring system for scheduler processes across multiple services',
    )
    .setVersion(appVersion)
    .addCookieAuth(cookieName)
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'API Key for authentication',
      },
      'api-key',
    )
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(swaggerPath, app, documentFactory, {
    jsonDocumentUrl,
    yamlDocumentUrl,
  });
}
