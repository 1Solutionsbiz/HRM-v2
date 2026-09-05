import { Type, plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
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

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET must be at least 32 characters long',
  })
  JWT_ACCESS_SECRET!: string;
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
