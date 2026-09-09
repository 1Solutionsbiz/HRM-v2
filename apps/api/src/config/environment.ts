import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsHexadecimal,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Fails startup immediately on a missing/malformed critical env var, rather
 * than surfacing as an obscure runtime error the first time a secret is used
 * (e.g. a JWT secret short enough to brute-force). Rule 9: security decisions
 * enforced on the backend, not left to whoever wrote the .env file.
 */
class EnvironmentVariables {
  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  // Explicit @Type: env vars arrive as strings, and relying on
  // `enableImplicitConversion`'s reflect-metadata inference proved
  // unreliable for a bare `= 3001` initializer with no type annotation.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  /**
   * The one origin CORS accepts (see main.ts) — an explicit allow-list, not
   * a wildcard. A bare `enableCors()` default reflects the request's own
   * Origin header, which is wide open; wrong for a system with
   * `payroll:manage` endpoints behind it.
   */
  @IsString()
  @MinLength(1)
  WEB_ORIGIN: string = 'http://localhost:3000';

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET must be at least 32 characters long',
  })
  JWT_ACCESS_SECRET!: string;

  // Raw 32-byte AES-256 key, hex-encoded (openssl rand -hex 32) — a
  // passphrase here would silently produce a weaker/wrong-length key at
  // first use deep inside EncryptionService instead of failing at startup.
  @IsHexadecimal()
  @Length(64, 64, {
    message: 'ENCRYPTION_KEY must be exactly 64 hex characters (32 raw bytes)',
  })
  ENCRYPTION_KEY!: string;

  /**
   * SMTP config for outbound mail (forgot-password today, more later).
   * Deliberately @IsOptional — unlike the secrets above, a missing value
   * here must not fail startup: MailService falls back to a logged no-op,
   * so the API (including login) stays up while mail is unconfigured.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  SMTP_HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 587;

  // Not @Type(() => Boolean): class-transformer's Boolean(...) coercion
  // maps the string "false" to `true` (any non-empty string is truthy) —
  // an explicit string comparison instead.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  SMTP_SECURE: boolean = false;

  @IsOptional()
  @IsString()
  @MinLength(1)
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  SMTP_PASSWORD?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  MAIL_FROM: string = '1Solutions HRM <hr@1solutions.biz>';
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(
      `Invalid environment configuration:\n${messages.join('\n')}`,
    );
  }
  return validated;
}
