import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import ormConfig from '../../src/core/database/mikro-orm.setup.js';
import { Phrase } from '../../src/modules/post/entities/phrase.entity.js';
import { Post } from '../../src/modules/post/entities/post.entity.js';
import { PostPart } from '../../src/modules/post/entities/post-part.entity.js';
import { Word } from '../../src/modules/post/entities/word.entity.js';
import { WordDefinition } from '../../src/modules/post/entities/word-definition.entity.js';

// Standalone MikroORM connection against the *dev* database this harness's
// content actually lives in — the direct equivalent of test/e2e/seed-web-e2e.ts's
// init (no Nest DI). Read-only: this harness never persists/flushes anything,
// it only loads what annotate-post's find-or-create logic already wrote for a
// real, already-ingested post.
export async function openDb(): Promise<MikroORM> {
  return MikroORM.init({
    ...ormConfig,
    entities: [Post, PostPart, Word, WordDefinition, Phrase],
    entitiesTs: [Post, PostPart, Word, WordDefinition, Phrase],
    allowGlobalContext: true,
    debug: false,
  });
}
