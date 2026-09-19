import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostStatus } from '../../enums/post-status.enum.js';
import { GetPostSuggestionsQuery } from './get-post-suggestions.query.js';
import type {
  PostSuggestionsView,
  PostSuggestionView,
} from './post-suggestions-view.js';

interface SuggestionRow {
  type: PostSuggestionView['type'];
  text: string;
}

// Backs the `/posts` search-box autocomplete (posts-list-page §2): words
// (`words.lemma`) and phrases (`phrases.phrase_text`) that start with the typed
// prefix AND occur in at least one published post — a suggestion that would
// filter the archive down to nothing is noise. Words and phrases are merged
// into one alphabetical list. Raw SQL (DP5): a two-table prefix scan with an
// EXISTS over `sentence_tokens` the ORM can't express cheaply.
@QueryHandler(GetPostSuggestionsQuery)
export class GetPostSuggestionsHandler
  implements IQueryHandler<GetPostSuggestionsQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    prefix,
    limit,
  }: GetPostSuggestionsQuery): Promise<PostSuggestionsView> {
    const normalized = prefix.trim().toLowerCase();
    if (!normalized) {
      return { items: [] };
    }
    const pattern = `${escapeLike(normalized)}%`;

    const rows = await this.em.getConnection().execute<SuggestionRow[]>(
      `SELECT type, text FROM (
         SELECT 'word' AS type, w.lemma AS text
           FROM words w
          WHERE lower(w.lemma) LIKE ?
            AND EXISTS (${publishedUsageSql('st.word_id = w.id')})
         UNION ALL
         SELECT 'phrase' AS type, ph.phrase_text AS text
           FROM phrases ph
          WHERE lower(ph.phrase_text) LIKE ?
            AND EXISTS (${publishedUsageSql('st.phrase_id = ph.id')})
       ) suggestions
       ORDER BY lower(text), type
       LIMIT ?`,
      [pattern, PostStatus.Published, pattern, PostStatus.Published, limit],
      'all',
      this.em.getTransactionContext(),
    );

    return { items: rows.map(({ type, text }) => ({ type, text })) };
  }
}

// `tokenMatch` is a fixed literal from this file, never user input; the one
// placeholder is the post status.
function publishedUsageSql(tokenMatch: string): string {
  return `SELECT 1
            FROM sentence_tokens st
            JOIN sentences s ON s.id = st.sentence_id
            JOIN posts p ON p.id = s.post_id
           WHERE ${tokenMatch}
             AND p.status = ?`;
}

// `%` / `_` / `\` typed by the learner must match literally, not as LIKE
// wildcards.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
