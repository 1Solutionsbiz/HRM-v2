import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind LiteSpeed's TLS-terminating proxy, req.protocol otherwise
  // always reads back as "http" (the internal connection to Node is
  // plain HTTP) - trust the proxy's X-Forwarded-Proto so anything built
  // from req.protocol (the receipt-upload URL) comes out https.
  app.set('trust proxy', true);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Single explicit origin (WEB_ORIGIN, see environment.ts) — no wildcard,
  // no reflecting the request's own Origin header.
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  // Uploaded files (expense receipts) are served by ExpensesController's
  // own GET /expenses/receipts/:filename, not app.useStaticAssets() -
  // see that handler's comment for why (a Passenger/LiteSpeed streaming
  // quirk on this deploy target, confirmed empirically).
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
