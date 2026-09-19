import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '../../../auth/entities/user.entity.js';
import { loadIrregularVerbsByLemma } from '../../../post/domain/irregular-verb.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import { resolveEffectiveState } from '../../domain/resolve-effective-state.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningDisposition } from '../../entities/learning-disposition.entity.js';
import { GetWordDictionaryDetailQuery } from './get-word-dictionary-detail.query.js';
import type {
  WordDictionaryDetailView,
  WordDictionaryPostView,
  WordDictionarySenseView,
} from './word-dictionary-detail-view.js';

interface WordRow {
  id: string;
  lemma: string;
  frequency_rank: number | null;
}

interface PostRow {
  short_id: string;
  slug: string | null;
  title: string | null;
  published_at: Date | null;
  is_read: boolean;
}

// Backs `/dictionary/words/:lemma` (dictionary-redesign §2): every sense of
// the lemma (not only the ones the learner saved — a lemma with one saved
// sense can still show its other senses as New/CEFR-known), irregular-verb
// forms if any, and the published posts using the word, newest first with a
// per-user read flag. `words.lemma` is case-insensitively unique (expression
// index), so the lookup is too. Returns null for an unknown lemma (controller
// -> 404).
@QueryHandler(GetWordDictionaryDetailQuery)
export class GetWordDictionaryDetailHandler
  implements IQueryHandler<GetWordDictionaryDetailQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    lemma,
    userId,
  }: GetWordDictionaryDetailQuery): Promise<WordDictionaryDetailView | null> {
    const word = await this.findWord(lemma);
    if (!word) {
      return null;
    }

    const [definitions, user, irregularVerbs] = await Promise.all([
      this.em.find(
        WordDefinition,
        { wordId: word.id },
        { disableIdentityMap: true },
      ),
      this.em.findOneOrFail(User, { id: userId }, { disableIdentityMap: true }),
      loadIrregularVerbsByLemma(),
    ]);

    const senses = await this.resolveSenses(
      definitions,
      userId,
      user.cefrLevel,
    );
    const posts = await this.queryPosts(word.id, userId);
    const irregularVerb = irregularVerbs.get(word.lemma.toLowerCase()) ?? null;

    return {
      lemma: word.lemma,
      frequencyRank: word.frequency_rank,
      irregularVerb: irregularVerb
        ? {
            pastSimple: irregularVerb.past_simple,
            pastParticiple: irregularVerb.past_participle,
          }
        : null,
      senses,
      posts,
    };
  }

  private async findWord(lemma: string): Promise<WordRow | null> {
    const rows = await this.em.getConnection().execute<WordRow[]>(
      `SELECT id, lemma, frequency_rank
         FROM words
        WHERE lower(lemma) = lower(?)
        LIMIT 1`,
      [lemma],
      'all',
      this.em.getTransactionContext(),
    );
    return rows[0] ?? null;
  }

  private async resolveSenses(
    definitions: WordDefinition[],
    userId: string,
    userCefrLevel: User['cefrLevel'],
  ): Promise<WordDictionarySenseView[]> {
    if (definitions.length === 0) {
      return [];
    }
    const definitionIds = definitions.map((d) => d.id);

    const [cards, dispositions] = await Promise.all([
      this.em.find(
        LearningCard,
        { userId, wordDefinitionId: { $in: definitionIds }, archivedAt: null },
        { disableIdentityMap: true },
      ),
      this.em.find(
        LearningDisposition,
        { userId, wordDefinitionId: { $in: definitionIds } },
        { disableIdentityMap: true },
      ),
    ]);
    const cardByDefinitionId = new Map(
      cards.map((card) => [card.wordDefinitionId as string, card]),
    );
    const dispositionByDefinitionId = new Map(
      dispositions.map((d) => [d.wordDefinitionId as string, d.disposition]),
    );

    return [...definitions]
      .sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0))
      .map((definition) => {
        const card = cardByDefinitionId.get(definition.id) ?? null;
        return {
          wordDefinitionId: definition.id,
          pos: definition.pos,
          definition: definition.definition ?? null,
          phonetic: definition.phonetic ?? null,
          example: definition.exampleSentence ?? null,
          cefrLevel: definition.cefrLevel ?? null,
          state: resolveEffectiveState({
            card: card
              ? { state: card.state, scheduledDays: card.scheduledDays }
              : null,
            disposition: dispositionByDefinitionId.get(definition.id) ?? null,
            targetCefrLevel: definition.cefrLevel,
            userCefrLevel,
          }),
          cardId: card?.id ?? null,
        };
      });
  }

  // Same indexed join as `GetDictionaryHandler` (sentence_tokens -> sentences
  // -> posts, published only), plus a per-user `post_reads` left join for the
  // read/unread split (PLAN.md dictionary-redesign §2). DP5 raw SQL — every id
  // is a bound param.
  private async queryPosts(
    wordId: string,
    userId: string,
  ): Promise<WordDictionaryPostView[]> {
    const rows = await this.em.getConnection().execute<PostRow[]>(
      `SELECT DISTINCT p.short_id, p.slug, p.title, p.published_at,
              (pr.id IS NOT NULL) AS is_read
         FROM sentence_tokens st
         JOIN sentences s ON s.id = st.sentence_id
         JOIN posts p ON p.id = s.post_id
         LEFT JOIN post_reads pr ON pr.post_id = p.id AND pr.user_id = ?
        WHERE p.status = ?
          AND st.word_id = ?
        ORDER BY p.published_at DESC NULLS LAST`,
      [userId, PostStatus.Published, wordId],
      'all',
      this.em.getTransactionContext(),
    );
    return rows.map((row) => ({
      shortId: row.short_id,
      slug: row.slug ?? null,
      title: row.title ?? null,
      isRead: row.is_read,
    }));
  }
}
