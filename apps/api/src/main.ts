import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { hostingOptions, mountWeb } from './web-hosting';
import { AppModule } from './app.module';
import { DatabaseErrorsFilter } from './database/database-errors.filter';
async function bootstrap() {
  if (!process.env.CSRF_SECRET || process.env.CSRF_SECRET.length < 32)
    throw new Error(
      'Configure CSRF_SECRET with at least 32 random characters.',
    );
  if (!process.env.APP_ORIGIN) throw new Error('Configure APP_ORIGIN.');
  if (
    process.env.PUBLIC_DATA_SOURCE &&
    !['legacy', 'system'].includes(process.env.PUBLIC_DATA_SOURCE)
  )
    throw new Error('PUBLIC_DATA_SOURCE must be legacy or system.');
  const hosting = hostingOptions();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.getHttpAdapter().getInstance().set('trust proxy', hosting.proxy);
  const { json } = await import('express');
  app.useGlobalFilters(new DatabaseErrorsFilter());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          frameSrc: [
            "'self'",
            'https://www.facebook.com',
            'https://www.youtube.com',
            'https://www.google.com',
          ],
        },
      },
    }),
  );
  app.use(json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(
    '/api/v1',
    (_req: unknown, res: import('express').Response, next: () => void) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  app.use(
    '/api/v1/auth/login',
    rateLimit({
      windowMs: 900000,
      limit: 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Demasiados intentos. Espera quince minutos.' },
    }),
  );
  app.use(
    '/api/v1/public/inquiries',
    rateLimit({
      windowMs: 3600000,
      limit: 5,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Please wait before sending another message.' },
    }),
  );
  if (hosting.serveWeb) await mountWeb(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), hosting.host);
}
void bootstrap();
