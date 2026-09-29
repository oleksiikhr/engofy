import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { WordDefinition } from '../entities/word-definition.entity.js';
import type { PartOfSpeech } from '../enums/part-of-speech.enum.js';

export interface WordRef {
  wordId: string;
  wordDefinitionId: string;
}

// Atomic find-or-create for the Word (by case-insensitive lemma) and its
// WordDefinition for one part of speech. A new definition has no text yet —
// the enrichment job (or a hand-written seed) fills it in.
export async function upsertWordDefinition(
  em: EntityManager,
  lemma: string,
  pos: PartOfSpeech,
): Promise<WordRef> {
  const wordId = await upsertWordId(em, lemma);

  // word_definitions has a real (word_id, pos) unique constraint, so
  // em.upsert() targets it directly — an atomic insert-or-fetch immune to
  // the concurrent-job race. 'ignore' keeps an existing definition's
  // cefrLevel/definition untouched. `id` must be passed explicitly (the
  // entity's field initializer only runs via `new`).
  const definition = await em.upsert(
    WordDefinition,
    { id: uuidv7(), wordId, pos },
    { onConflictFields: ['wordId', 'pos'], onConflictAction: 'ignore' },
  );

  return { wordId, wordDefinitionId: definition.id };
}

// Word.lemma's uniqueness is a lower(lemma) expression index, which
// em.upsert()'s onConflictFields can't target, so this is raw SQL. Two
// concurrent jobs racing the same lemma resolve atomically at the DB level;
// the no-op DO UPDATE lets the one round trip return the existing row's id
// on conflict.
async function upsertWordId(em: EntityManager, lemma: string): Promise<string> {
  const rows = await em.getConnection().execute<{ id: string }[]>(
    `INSERT INTO words (id, lemma, created_at, updated_at)
       VALUES (?, ?, now(), now())
       ON CONFLICT (lower(lemma)) DO UPDATE SET lemma = words.lemma
       RETURNING id`,
    [uuidv7(), lemma],
    'all',
    em.getTransactionContext(),
  );

  return (rows[0] as { id: string }).id;
}
