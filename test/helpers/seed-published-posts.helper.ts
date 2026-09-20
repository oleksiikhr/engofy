import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';

// Bulk-inserts published posts one second apart, ending an hour ago, so a
// page-size boundary is testable without one ORM round-trip per row.
export async function seedPublishedPosts(
  em: EntityManager,
  count: number,
): Promise<void> {
  const prefix = randomUUID().slice(0, 8);
  await em.getConnection().execute(
    `INSERT INTO posts (id, source_format, source_raw_text, short_id, status,
                        published_at, content_updated_at, created_at, updated_at)
     SELECT gen_random_uuid(), 'text', 'seed', ? || n, 'published',
            now() - interval '1 hour' - (? - n) * interval '1 second',
            now(), now(), now()
       FROM generate_series(1, ?) AS n`,
    [prefix, count, count],
    'run',
    em.getTransactionContext(),
  );
}
