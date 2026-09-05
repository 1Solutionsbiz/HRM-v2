import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Prisma 7's `prisma-client` generator requires a driver adapter — there is
 * no more implicit "read DATABASE_URL from the schema" behaviour. `mariadb`
 * is a pure-JS driver (no native build step), which matters on this machine:
 * no Homebrew/Docker/build tools are available in this environment.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaMariaDb(
        configService.getOrThrow<string>('DATABASE_URL'),
      ),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
