import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';

@Entity({ tableName: 'words' })
@Unique({
  name: 'words_lemma_unique_idx',
  expression: (columns, table, indexName) =>
    `create unique index "${indexName}" on "${table.name}" (lower("${columns.lemma}"))`,
})
export class Word {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'text' })
  lemma!: string;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
