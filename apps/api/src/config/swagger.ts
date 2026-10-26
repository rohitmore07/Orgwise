import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { API_GLOBAL_PREFIX } from '../common/constants/app.constants';

const logger = new Logger('Swagger');
// Bootstraps OpenAPI documentation for the API. Served at `{SWAGGER_PATH}` under the global prefix (default…
// `/api/v1/docs`) so the docs live next to the versioned API.
export function setupSwagger(app: INestApplication): void {
  const config = app.get(ConfigService);

  const documentConfig = new DocumentBuilder()
    .setTitle('orgwise API')
    .setDescription(
      'Enterprise Workforce Intelligence Platform — REST API. Authentication is ' +
        'provided by Neon Auth (Managed Better Auth): sign in on the web app and the ' +
        '`__Secure-neon-auth.session_token` cookie travels with every request (same-site ' +
        'API). The API validates it against Neon Auth and resolves your platform role ' +
        '(admin / manager / viewer). API clients may also send the cookie value as ' +
        '`Authorization: Bearer <session-cookie>`.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description:
          'Neon Auth `__Secure-neon-auth.session_token` cookie value (obtained by signing in on the web app)',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  const path = config.get<string>('swagger.path', 'docs');

  SwaggerModule.setup(path, app, document, { useGlobalPrefix: true });

  logger.log(`Swagger UI available at /${API_GLOBAL_PREFIX}/${path}`);
}
