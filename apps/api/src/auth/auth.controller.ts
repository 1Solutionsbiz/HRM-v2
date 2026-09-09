import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

function requestMeta(request: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return { ipAddress: request.ip, userAgent: request.headers['user-agent'] };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, requestMeta(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto, requestMeta(request));
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: RequestPasswordResetDto,
    @Req() request: Request,
  ) {
    await this.authService.requestPasswordReset(dto, requestMeta(request));
    // Same message whether or not the email matched an account.
    return {
      message:
        "If an account exists for that email, we've sent a password reset link.",
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(dto, requestMeta(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() authContext: AuthContext, @Req() request: Request) {
    return this.authService.logout(authContext, requestMeta(request));
  }

  @Get('me')
  me(@CurrentUser() authContext: AuthContext) {
    return this.authService.me(authContext.userId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() authContext: AuthContext,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(
      authContext,
      dto,
      requestMeta(request),
    );
  }
}
