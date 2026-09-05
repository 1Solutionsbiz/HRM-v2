import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  // JwtModule is re-exported so the app-wide JwtAuthGuard (registered as a
  // global APP_GUARD in AppModule) can inject JwtService — Nest only makes
  // an imported module's exports visible to modules that import *this*
  // module, so without this AppModule couldn't see it.
  exports: [JwtModule],
})
export class AuthModule {}
