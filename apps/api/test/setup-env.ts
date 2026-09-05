// e2e specs boot the real AppModule (ConfigModule.forRoot with validation),
// so the same env vars main.ts relies on must be present here too. Vitest
// doesn't load .env on its own the way `dotenv/config` via the Nest CLI does.
import 'dotenv/config';
