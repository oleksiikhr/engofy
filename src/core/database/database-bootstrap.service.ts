import { MikroORM } from '@mikro-orm/postgresql';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';

// MikroORM v7's `MikroORM.init()` no longer opens the connection (the `connect`
// step was dropped; `@mikro-orm/nestjs` has no bootstrap hook for it either),
// so the pool connects lazily on the first query. That leaves `/_healthz/ready`
// answering 503 "Not connected to database" from boot until some other request
// happens to run a query first — the Kysely `checkConnection()` short-circuits
// on `!connected`, so the readiness probe can never establish the connection it
// checks. Opening it here also fails a bad DB config at startup instead of on
// the first request.
@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(private readonly orm: MikroORM) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.orm.connect();
    this.logger.log('database connection established');
  }
}
