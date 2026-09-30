import type { ConnectionOptions } from 'node:tls';
import { envBool, envString } from './env.helper.js';

// TLS for a managed service (DigitalOcean Postgres / Valkey). Off by default so
// local dev and the compose stacks stay plaintext. `<PREFIX>_SSL_CA` is the
// provider's CA certificate (PEM) — needed because it is not in the system store.
export function tlsOptions(prefix: string): ConnectionOptions | undefined {
  if (!envBool(`${prefix}_SSL`)) {
    return undefined;
  }

  return { ca: envString(`${prefix}_SSL_CA`), rejectUnauthorized: true };
}
