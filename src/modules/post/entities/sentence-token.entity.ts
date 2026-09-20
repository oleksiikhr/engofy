import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { Phrase } from './phrase.entity.js';
import { Sentence } from './sentence.entity.js';
import { Word } from './word.entity.js';

// One row per spaCy token of a Sentence. This is the deterministic NLP layer;
// its POS/tag/dep fields are raw spaCy output, deliberately not the curated
// PartOfSpeech enum (that belongs to the AI/word-definition layer). See
// PLAN.md §12.
@Entity({ tableName: 'sentence_tokens' })
@Unique({ properties: ['sentenceId', 'position'] })
export class SentenceToken {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  // Covered by the leading column of the composite unique above.
  @ManyToOne(() => Sentence, {
    mapToPk: true,
    fieldName: 'sentence_id',
    deleteRule: 'cascade',
  })
  sentenceId!: string;

  // Token order within the sentence.
  @Property({ type: 'integer' })
  position!: number;

  @Property({ type: 'text' })
  text!: string;

  // Char offsets within Sentence.rawText.
  @Property({ type: 'integer' })
  charStart!: number;

  @Property({ type: 'integer' })
  charEnd!: number;

  @Property({ type: 'text' })
  lemma!: string;

  // Raw spaCy: UPOS (token.pos_), Penn tag (token.tag_), dependency label
  // (token.dep_).
  @Property({ type: 'text' })
  pos!: string;

  @Property({ type: 'text' })
  tag!: string;

  @Property({ type: 'text' })
  dep!: string;

  // Position of this token's syntactic head within the same sentence
  // (token.head.i - sentence start), or null when the token is its own root.
  // Needed to group discontinuous phrasal verbs and detect gerunds
  // deterministically (PLAN.md §12).
  @Property({ type: 'integer', nullable: true })
  headPosition?: number | null;

  // token.morph as a plain map, e.g. { Tense: 'Past', VerbForm: 'Fin' };
  // {} when spaCy reports no morphology.
  @Property({ type: 'json' })
  morph!: Record<string, string>;

  // Set by the deterministic phrasal-verb grouping in spacy_parse: every
  // fragment of one discontinuous phrasal verb ('picked' ... 'up') shares the
  // same Phrase id here. FK -> phrases.id.
  @ManyToOne(() => Phrase, {
    mapToPk: true,
    fieldName: 'phrasal_verb_group_id',
    deleteRule: 'restrict',
    nullable: true,
  })
  phrasalVerbGroupId?: string | null;

  @Property({ type: 'boolean', default: false })
  isGerund: Opt<boolean> = false;

  @Property({ type: 'boolean', default: false })
  isIdiomPart: Opt<boolean> = false;

  // Linked by the annotation stage (Slice 3 rework). FK -> words.id.
  // Indexed: `/dictionary` derives each card term's "appears in" post list by
  // joining sentence_tokens -> sentences -> posts on this column.
  @ManyToOne(() => Word, {
    mapToPk: true,
    fieldName: 'word_id',
    deleteRule: 'restrict',
    nullable: true,
  })
  @Index()
  wordId?: string | null;

  // FK -> phrases.id. Indexed for the same `/dictionary` join as wordId.
  @ManyToOne(() => Phrase, {
    mapToPk: true,
    fieldName: 'phrase_id',
    deleteRule: 'restrict',
    nullable: true,
  })
  @Index()
  phraseId?: string | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
