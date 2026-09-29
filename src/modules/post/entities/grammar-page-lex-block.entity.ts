import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { GrammarConstruction } from './grammar-construction.entity.js';

// One clickable span of a text block, as a half-open char range in the
// block's text, linking either a word sense or a phrase.
export type GrammarPageLexSpan = {
  start: number;
  end: number;
} & ({ wordDefinitionId: string } | { phraseId: string });

// The word / phrase spans of one text block of a construction's handcrafted page
// (apps/web `src/grammar-pages/*.astro`), keyed by the hash of the block's
// text (`lexBlockHash`) so the page matches a block without sending it back.
// Written only by `grammar annotate-pages` (spaCy, no AI); a block whose text
// changed simply has no row until the command is re-run.
@Entity({ tableName: 'grammar_page_lex_blocks' })
@Unique({ properties: ['constructionId', 'textHash'] })
export class GrammarPageLexBlock {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @ManyToOne(() => GrammarConstruction, {
    mapToPk: true,
    fieldName: 'construction_id',
    deleteRule: 'cascade',
  })
  constructionId!: string;

  @Property({ type: 'text' })
  textHash!: string;

  @Property({ type: 'json' })
  spans!: GrammarPageLexSpan[];

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
