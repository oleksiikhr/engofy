import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Standalone script, no NestJS ConfigModule around to load .env for us —
// parses simple KEY=VALUE lines only (no quoting/expansion), which is all
// ANTHROPIC_API_KEY/AI_MODEL need. Never overwrites a value already present
// in the environment (lets a real shell export win over the file).
function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const repoRoot = resolve(import.meta.dirname, '../..');
loadEnvFile(resolve(repoRoot, '.env.development.local'));
loadEnvFile(resolve(repoRoot, '.env.development'));

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing ${key} — set it in .env.development.local or export it before running.`,
    );
  }
  return value;
}
