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
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';

@Entity({ tableName: 'word_definitions' })
@Unique({ properties: ['wordId', 'pos'] })
export class WordDefinition {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  wordId!: string;

  @Enum(() => PartOfSpeech)
  pos!: PartOfSpeech;

  // '' = stub, not yet enriched by the fill-word-definition job (Phase 2).
  @Property({ type: 'text', default: '' })
  definition: Opt<string> = '';

  @Property({ type: 'text', nullable: true })
  phonetic?: string | null;

  @Enum(() => CefrLevel)
  cefrLevel!: CefrLevel;

  @Property({ type: 'text', nullable: true })
  exampleSentence?: string | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
