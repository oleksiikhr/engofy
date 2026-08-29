import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { CefrLevel } from '../enums/cefr-level.enum.js';
import { PhraseType } from '../enums/phrase-type.enum.js';

@Entity({ tableName: 'phrases' })
@Unique({
  name: 'phrases_phrase_text_unique_idx',
  expression: (columns, table, indexName) =>
    `create unique index "${indexName}" on "${table.name}" (lower("${columns.phraseText}"))`,
})
export class Phrase {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'text' })
  phraseText!: string;

  // null = not yet classified by the post_annotation job (Phase 2). Also
  // where a phrase made of non-adjacent words lives — e.g. "took it off":
  // the annotation job emits two PhraseSpanNode fragments ("took", "off")
  // sharing this same Phrase's id, and this field says what kind of phrase
  // they jointly form. No extra grouping column needed on the span nodes
  // themselves; shared phraseId already ties fragments together (see
  // domain/splice-spans.ts — nothing there assumes one span per phraseId).
  @Enum({ items: () => PhraseType, nullable: true })
  type?: PhraseType | null;

  // null = stub, not yet enriched by the fill-phrase job (Phase 2).
  @Property({ type: 'text', nullable: true })
  definition?: string | null;

  @Property({ type: 'text', nullable: true })
  exampleSentence?: string | null;

  @Enum({ items: () => CefrLevel, nullable: true })
  cefrLevel?: CefrLevel | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
