import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import type { PhraseType } from '../enums/phrase-type.enum.js';

// Atomic find-or-create for a Phrase by case-insensitive text.
//
// phrases has a `lower(phrase_text)` expression unique index, which
// em.upsert()'s onConflictFields can't target (it only emits
// `on conflict ("phrase_text")`), so this is raw SQL. The no-op
// `do update set phrase_text = phrases.phrase_text` (rather than
// `do nothing`) makes the one round trip return the existing row's id on
// conflict too. `type` is only ever written on first insert — an existing
// phrase's classification is left untouched.
//
// Same logic as AnnotatePostHandler.upsertPhraseId; the annotation handler
// keeps its private copy until Slice 3 reworks that pipeline.
export async function upsertPhraseId(
  em: EntityManager,
  phraseText: string,
  type: PhraseType | null,
): Promise<string> {
  const rows = await em.getConnection().execute<{ id: string }[]>(
    `INSERT INTO phrases (id, phrase_text, type, created_at, updated_at)
       VALUES (?, ?, ?, now(), now())
       ON CONFLICT (lower(phrase_text)) DO UPDATE SET phrase_text = phrases.phrase_text
       RETURNING id`,
    [uuidv7(), phraseText, type],
    'all',
    em.getTransactionContext(),
  );

  return (rows[0] as { id: string }).id;
}
