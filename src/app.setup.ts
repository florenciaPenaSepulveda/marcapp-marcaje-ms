import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { Env, origenesPermitidos } from './config/env';

const ORIGENES_DE_DESARROLLO = [
  'http://localhost:8081',
  'http://localhost:19006',
];

export const configurarApp = (app: INestApplication): void => {
  const config = app.get(ConfigService<Env, true>);
  const origenes = origenesPermitidos(
    config.get('CORS_ORIGINS', { infer: true }),
  );
  const produccion = config.get('NODE_ENV', { infer: true }) === 'production';

  if (config.get('TRUST_PROXY', { infer: true }) === 'true') {
    (app as unknown as { set: (clave: string, valor: unknown) => void }).set(
      'trust proxy',
      1,
    );
  }
  app.use(helmet());
  app.enableCors({
    origin:
      origenes.length > 0
        ? origenes
        : produccion
          ? false
          : ORIGENES_DE_DESARROLLO,
    methods: ['GET', 'POST', 'PATCH'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
};
