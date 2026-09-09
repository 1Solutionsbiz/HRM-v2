import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
  // Serves uploaded files (expense receipts) — see UPLOADS_DIR in
  // environment.ts for why this lives outside the app's own directory.
  app.useStaticAssets(resolve(process.env.UPLOADS_DIR ?? './uploads'), { prefix: '/uploads' });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
