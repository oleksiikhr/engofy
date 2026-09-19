import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '../../../auth/entities/user.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import { resolveEffectiveState } from '../../domain/resolve-effective-state.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningDisposition } from '../../entities/learning-disposition.entity.js';
import { GetPhraseDictionaryDetailQuery } from './get-phrase-dictionary-detail.query.js';
import type {
  PhraseDictionaryDetailView,
  PhraseDictionaryPostView,
} from './phrase-dictionary-detail-view.js';

interface PostRow {
  short_id: string;
  slug: string | null;
  title: string | null;
  published_at: Date | null;
  is_read: boolean;
}

// Backs `/dictionary/phrases/:phrase` (dictionary-redesign §3): the phrase's
// definition/example/CEFR, its effective state for this learner (with the
// active card id behind it), and the published posts using it, newest first
// with a per-user read flag. `phrases.phrase_text` is case-insensitively
// unique (expression index), so the lookup is too. Returns null for an
// unknown phrase (controller -> 404).
@QueryHandler(GetPhraseDictionaryDetailQuery)
export class GetPhraseDictionaryDetailHandler
  implements IQueryHandler<GetPhraseDictionaryDetailQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    phraseText,
    userId,
  }: GetPhraseDictionaryDetailQuery): Promise<PhraseDictionaryDetailView | null> {
    const phrase = await this.findPhrase(phraseText);
    if (!phrase) {
      return null;
    }

    const [user, card, disposition, posts] = await Promise.all([
      this.em.findOneOrFail(User, { id: userId }, { disableIdentityMap: true }),
      this.em.findOne(
        LearningCard,
        { userId, phraseId: phrase.id, archivedAt: null },
        { disableIdentityMap: true },
      ),
      this.em.findOne(
        LearningDisposition,
        { userId, phraseId: phrase.id },
        { disableIdentityMap: true },
      ),
      this.queryPosts(phrase.id, userId),
    ]);

    return {
      phraseId: phrase.id,
      phraseText: phrase.phraseText,
      type: phrase.type ?? null,
      definition: phrase.definition ?? null,
      example: phrase.exampleSentence ?? null,
      cefrLevel: phrase.cefrLevel ?? null,
      state: resolveEffectiveState({
        card: card
          ? { state: card.state, scheduledDays: card.scheduledDays }
          : null,
        disposition: disposition?.disposition ?? null,
        targetCefrLevel: phrase.cefrLevel,
        userCefrLevel: user.cefrLevel,
      }),
      cardId: card?.id ?? null,
      posts,
    };
  }

  private async findPhrase(phraseText: string): Promise<Phrase | null> {
    const rows = await this.em.getConnection().execute<{ id: string }[]>(
      `SELECT id
         FROM phrases
        WHERE lower(phrase_text) = lower(?)
        LIMIT 1`,
      [phraseText],
      'all',
      this.em.getTransactionContext(),
    );
    const id = rows[0]?.id;
    return id
      ? this.em.findOneOrFail(Phrase, { id }, { disableIdentityMap: true })
      : null;
  }

  // Same indexed join as `GetDictionaryHandler.queryUsage` (sentence_tokens
  // -> sentences -> posts, published only), plus a per-user `post_reads` left
  // join for the read/unread split. DP5 raw SQL — every id is a bound param.
  private async queryPosts(
    phraseId: string,
    userId: string,
  ): Promise<PhraseDictionaryPostView[]> {
    const rows = await this.em.getConnection().execute<PostRow[]>(
      `SELECT DISTINCT p.short_id, p.slug, p.title, p.published_at,
              (pr.id IS NOT NULL) AS is_read
         FROM sentence_tokens st
         JOIN sentences s ON s.id = st.sentence_id
         JOIN posts p ON p.id = s.post_id
         LEFT JOIN post_reads pr ON pr.post_id = p.id AND pr.user_id = ?
        WHERE p.status = ?
          AND st.phrase_id = ?
        ORDER BY p.published_at DESC NULLS LAST`,
      [userId, PostStatus.Published, phraseId],
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
