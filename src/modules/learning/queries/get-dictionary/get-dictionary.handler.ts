import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '../../../auth/entities/user.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import {
  EffectiveState,
  resolveEffectiveState,
} from '../../domain/resolve-effective-state.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningDisposition } from '../../entities/learning-disposition.entity.js';
import {
  decodeDictionaryCursor,
  encodeDictionaryCursor,
} from './dictionary-cursor.js';
import type {
  DictionaryEntryView,
  DictionaryPostRefView,
  DictionaryView,
} from './dictionary-view.js';
import { GetDictionaryQuery } from './get-dictionary.query.js';

// Priority for picking one sense to represent a multi-sense lemma group when
// no `state` filter narrows it to a single state (see `GroupRow.state` below)
// — the sense that most needs the learner's attention wins: still being
// learned > explicitly skipped > already mastered.
const SENSE_PRIORITY: Record<EffectiveState, number> = {
  [EffectiveState.Learning]: 3,
  [EffectiveState.Skipped]: 2,
  [EffectiveState.Learned]: 1,
  [EffectiveState.New]: 0,
};

// Backs `/dictionary` (dictionary-redesign §1): the learner's saved word
// senses and phrases, merged from two sources per learning-foundation §2 —
// an active `LearningCard` (state = Learning/Learned) and, for a target with
// no active card, a `LearningDisposition` (Learned when Known, Skipped) —
// otherwise a manual "Пропустив"/"Вивчив" call with no card behind it would
// never surface. `EffectiveState.New` never appears: every row here already
// has a card or a disposition, so the CEFR-default tier of
// `resolveEffectiveState` never applies. Words are grouped by lemma (one row
// per word, however many senses are saved) so `/dictionary/[lemma]` (зріз 2)
// has somewhere to send the learner for the rest; phrases have no senses to
// group and get one row each. Paginated by lemma-group, not raw row — the
// cursor sorts on `(lowercased primary, groupId)`.
@QueryHandler(GetDictionaryQuery)
export class GetDictionaryHandler implements IQueryHandler<GetDictionaryQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
    options,
  }: GetDictionaryQuery): Promise<DictionaryView> {
    const cursor = decodeDictionaryCursor(options.cursor);

    const [user, cards, dispositions] = await Promise.all([
      this.em.findOneOrFail(User, { id: userId }, { disableIdentityMap: true }),
      this.em.find(
        LearningCard,
        {
          userId,
          archivedAt: null,
          $or: [
            { wordDefinitionId: { $ne: null } },
            { phraseId: { $ne: null } },
          ],
        },
        { disableIdentityMap: true },
      ),
      this.em.find(
        LearningDisposition,
        {
          userId,
          $or: [
            { wordDefinitionId: { $ne: null } },
            { phraseId: { $ne: null } },
          ],
        },
        { disableIdentityMap: true },
      ),
    ]);

    const targets = this.mergeTargets(cards, dispositions, user.cefrLevel);
    const filtered = options.state
      ? targets.filter((target) => target.state === options.state)
      : targets;
    if (filtered.length === 0) {
      return { items: [], nextCursor: null };
    }

    const wordDefinitionIds = unique(
      filtered
        .filter((target) => target.type === 'wordDefinition')
        .map((target) => target.id),
    );
    const phraseIds = unique(
      filtered
        .filter((target) => target.type === 'phrase')
        .map((target) => target.id),
    );

    const [definitions, phrases] = await Promise.all([
      wordDefinitionIds.length
        ? this.em.find(
            WordDefinition,
            { id: { $in: wordDefinitionIds } },
            { disableIdentityMap: true },
          )
        : Promise.resolve([]),
      phraseIds.length
        ? this.em.find(
            Phrase,
            { id: { $in: phraseIds } },
            { disableIdentityMap: true },
          )
        : Promise.resolve([]),
    ]);
    const wordIds = unique(definitions.map((definition) => definition.wordId));
    const words = wordIds.length
      ? await this.em.find(
          Word,
          { id: { $in: wordIds } },
          { disableIdentityMap: true },
        )
      : [];

    const groups = this.buildGroups(filtered, definitions, words, phrases);

    const search = options.search?.trim().toLowerCase();
    const searched = search
      ? groups.filter((group) => group.sortKey.includes(search))
      : groups;
    searched.sort(compareGroups);

    const remaining = cursor
      ? searched.filter((group) => compareToCursor(group, cursor) > 0)
      : searched;
    const page = remaining.slice(0, options.limit);
    const hasMore = remaining.length > page.length;

    const usage = await this.buildUsageIndex(
      page
        .filter((group) => group.type === 'word')
        .map((group) => group.groupId),
      page
        .filter((group) => group.type === 'phrase')
        .map((group) => group.groupId),
    );

    const items: DictionaryEntryView[] = page.map((group) => ({
      type: group.type,
      primary: group.primary,
      state: group.state,
      senseCount: group.senseCount,
      secondary: group.secondary,
      definition: group.definition,
      example: group.example,
      cefrLevel: group.cefrLevel,
      posts:
        (group.type === 'word'
          ? usage.byWord.get(group.groupId)
          : usage.byPhrase.get(group.groupId)) ?? [],
    }));

    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeDictionaryCursor({
            sortKey: last.sortKey,
            groupType: last.type,
            groupId: last.groupId,
          })
        : null;

    return { items, nextCursor };
  }

  // One row per saved target (word sense or phrase), card and disposition
  // merged — a card always wins for the same target (the two entities'
  // per-target unique constraints mean both existing simultaneously
  // shouldn't happen; still, iterate cards first so a card wins if it does).
  private mergeTargets(
    cards: LearningCard[],
    dispositions: LearningDisposition[],
    userCefrLevel: User['cefrLevel'],
  ): Target[] {
    const byKey = new Map<string, Target>();
    for (const card of cards) {
      const target = cardTarget(card);
      const state = resolveEffectiveState({
        card: { state: card.state, scheduledDays: card.scheduledDays },
        userCefrLevel,
      });
      byKey.set(targetKey(target), {
        ...target,
        state,
        activityAt: card.due.toMillis(),
      });
    }
    for (const disposition of dispositions) {
      const target = dispositionTarget(disposition);
      const key = targetKey(target);
      if (byKey.has(key)) {
        continue;
      }
      const state = resolveEffectiveState({
        disposition: disposition.disposition,
        userCefrLevel,
      });
      byKey.set(key, {
        ...target,
        state,
        activityAt: disposition.updatedAt.toMillis(),
      });
    }
    return [...byKey.values()];
  }

  private buildGroups(
    targets: Target[],
    definitions: WordDefinition[],
    words: Word[],
    phrases: Phrase[],
  ): GroupRow[] {
    const definitionById = new Map(definitions.map((d) => [d.id, d]));
    const wordById = new Map(words.map((w) => [w.id, w]));
    const phraseById = new Map(phrases.map((p) => [p.id, p]));

    return [
      ...buildWordGroups(targets, definitionById, wordById),
      ...buildPhraseGroups(targets, phraseById),
    ];
  }

  // Same indexed join as before the redesign: sentence_tokens (filtered on
  // word_id / phrase_id) -> sentences -> posts (published only). DISTINCT
  // collapses repeat mentions to one row per (term, post); ORDER BY hands
  // rows back newest-first. DP5 raw SQL — `column` is a fixed literal, every
  // id is a bound param.
  private async buildUsageIndex(
    wordIds: string[],
    phraseIds: string[],
  ): Promise<UsageIndex> {
    const index: UsageIndex = { byWord: new Map(), byPhrase: new Map() };
    if (wordIds.length) {
      collectUsage(await this.queryUsage('word_id', wordIds), index.byWord);
    }
    if (phraseIds.length) {
      collectUsage(
        await this.queryUsage('phrase_id', phraseIds),
        index.byPhrase,
      );
    }
    return index;
  }

  private async queryUsage(
    column: 'word_id' | 'phrase_id',
    targetIds: string[],
  ): Promise<UsageRow[]> {
    const placeholders = targetIds.map(() => '?').join(', ');
    return this.em.getConnection().execute<UsageRow[]>(
      `SELECT DISTINCT st.${column} AS target_id, p.short_id, p.slug, p.title,
              p.published_at
         FROM sentence_tokens st
         JOIN sentences s ON s.id = st.sentence_id
         JOIN posts p ON p.id = s.post_id
        WHERE p.status = ?
          AND st.${column} IN (${placeholders})
        ORDER BY p.published_at DESC NULLS LAST`,
      [PostStatus.Published, ...targetIds],
      'all',
      this.em.getTransactionContext(),
    );
  }
}

interface WordTarget {
  type: 'wordDefinition';
  id: string;
}
interface PhraseTarget {
  type: 'phrase';
  id: string;
}
type RawTarget = WordTarget | PhraseTarget;
type Target = RawTarget & { state: EffectiveState; activityAt: number };
type ResolvedWordTarget = WordTarget & {
  state: EffectiveState;
  activityAt: number;
};
interface WordSense {
  target: ResolvedWordTarget;
  definition: WordDefinition;
}

interface GroupRow {
  type: 'word' | 'phrase';
  groupId: string;
  primary: string;
  sortKey: string;
  state: EffectiveState;
  senseCount: number;
  secondary: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: DictionaryEntryView['cefrLevel'];
}

interface UsageRow {
  target_id: string;
  short_id: string;
  slug: string | null;
  title: string | null;
  published_at: Date | null;
}

interface UsageIndex {
  byWord: Map<string, DictionaryPostRefView[]>;
  byPhrase: Map<string, DictionaryPostRefView[]>;
}

function groupSensesByWordId(
  targets: Target[],
  definitionById: Map<string, WordDefinition>,
  wordById: Map<string, Word>,
): Map<string, WordSense[]> {
  const senseByWordId = new Map<string, WordSense[]>();
  for (const target of targets) {
    if (target.type !== 'wordDefinition') {
      continue;
    }
    const definition = definitionById.get(target.id);
    const word = definition ? wordById.get(definition.wordId) : undefined;
    if (!definition || !word) {
      continue;
    }
    const senses = senseByWordId.get(word.id) ?? [];
    senses.push({ target, definition });
    senseByWordId.set(word.id, senses);
  }
  return senseByWordId;
}

function buildWordGroups(
  targets: Target[],
  definitionById: Map<string, WordDefinition>,
  wordById: Map<string, Word>,
): GroupRow[] {
  const senseByWordId = groupSensesByWordId(targets, definitionById, wordById);
  const groups: GroupRow[] = [];
  for (const [wordId, senses] of senseByWordId) {
    const word = wordById.get(wordId);
    if (!word) {
      continue;
    }
    const primarySense = pickPrimarySense(senses);
    groups.push({
      type: 'word',
      groupId: wordId,
      primary: word.lemma,
      sortKey: word.lemma.toLowerCase(),
      state: primarySense.target.state,
      senseCount: senses.length,
      secondary: primarySense.definition.pos,
      definition: primarySense.definition.definition ?? null,
      example: primarySense.definition.exampleSentence ?? null,
      cefrLevel: primarySense.definition.cefrLevel ?? null,
    });
  }
  return groups;
}

function buildPhraseGroups(
  targets: Target[],
  phraseById: Map<string, Phrase>,
): GroupRow[] {
  const groups: GroupRow[] = [];
  for (const target of targets) {
    if (target.type !== 'phrase') {
      continue;
    }
    const phrase = phraseById.get(target.id);
    if (!phrase) {
      continue;
    }
    groups.push({
      type: 'phrase',
      groupId: phrase.id,
      primary: phrase.phraseText,
      sortKey: phrase.phraseText.toLowerCase(),
      state: target.state,
      senseCount: 1,
      secondary: null,
      definition: phrase.definition ?? null,
      example: phrase.exampleSentence ?? null,
      cefrLevel: phrase.cefrLevel ?? null,
    });
  }
  return groups;
}

function cardTarget(card: LearningCard): RawTarget {
  return card.wordDefinitionId
    ? { type: 'wordDefinition', id: card.wordDefinitionId }
    : { type: 'phrase', id: card.phraseId as string };
}

function dispositionTarget(disposition: LearningDisposition): RawTarget {
  return disposition.wordDefinitionId
    ? { type: 'wordDefinition', id: disposition.wordDefinitionId }
    : { type: 'phrase', id: disposition.phraseId as string };
}

function targetKey(target: RawTarget): string {
  return `${target.type}:${target.id}`;
}

function pickPrimarySense(senses: WordSense[]): WordSense {
  return senses.reduce((best, sense) => {
    const priority = SENSE_PRIORITY[sense.target.state];
    const bestPriority = SENSE_PRIORITY[best.target.state];
    if (priority !== bestPriority) {
      return priority > bestPriority ? sense : best;
    }
    return sense.target.activityAt < best.target.activityAt ? sense : best;
  });
}

function compareGroups(a: GroupRow, b: GroupRow): number {
  if (a.sortKey !== b.sortKey) {
    return a.sortKey < b.sortKey ? -1 : 1;
  }
  return a.groupId < b.groupId ? -1 : a.groupId > b.groupId ? 1 : 0;
}

function compareToCursor(
  group: GroupRow,
  cursor: { sortKey: string; groupType: 'word' | 'phrase'; groupId: string },
): number {
  if (group.sortKey !== cursor.sortKey) {
    return group.sortKey < cursor.sortKey ? -1 : 1;
  }
  return group.groupId < cursor.groupId
    ? -1
    : group.groupId > cursor.groupId
      ? 1
      : 0;
}

// Rows arrive newest-first (SQL ORDER BY), so appending in order keeps each
// per-term list newest-first.
function collectUsage(
  rows: UsageRow[],
  target: Map<string, DictionaryPostRefView[]>,
): void {
  for (const row of rows) {
    const list = target.get(row.target_id) ?? [];
    list.push({
      shortId: row.short_id,
      slug: row.slug ?? null,
      title: row.title ?? null,
    });
    target.set(row.target_id, list);
  }
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}
