import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { factories } from '../../../../../test/factories/factories.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { GetPostSuggestionsQuery } from './get-post-suggestions.query.js';

function seedPostWith(
  em: EntityManager,
  status: PostStatus,
  link: { wordId?: string; phraseId?: string },
): void {
  const source = { format: PostSourceFormat.Text, rawText: 'seed' };
  const post = factories(em).post.makeOne({
    source,
    title: 'seed',
    status,
  });
  const sentence = factories(em).sentence.makeOne({
    postId: post.id,
    postPartId: factories(em).postPart.makeOne({ postId: post.id }).id,
    unitIndex: 0,
    position: 0,
    rawText: 'seed.',
    charStart: 0,
    charEnd: 5,
  });
  factories(em).sentenceToken.makeOne({
    sentenceId: sentence.id,
    position: 0,
    text: 'seed',
    charStart: 0,
    charEnd: 4,
    lemma: 'seed',
    pos: 'NOUN',
    tag: 'NN',
    dep: 'ROOT',
    morph: {},
    ...link,
  });
}

describe('GetPostSuggestionsHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('suggests words and phrases by case-insensitive prefix, only those in a published post, alphabetically', async () => {
    const em = suite.orm.em;
    const tag = randomUUID().slice(0, 8);
    const harbour = factories(em).word.makeOne({ lemma: `Zqx${tag}-harbour` });
    const harvest = factories(em).word.makeOne({ lemma: `zqx${tag}-harvest` });
    const draftOnly = factories(em).word.makeOne({ lemma: `zqx${tag}-draft` });
    const unused = factories(em).word.makeOne({ lemma: `zqx${tag}-unused` });
    const phrase = factories(em).phrase.makeOne({
      phraseText: `zqx${tag} at last`,
    });
    await em.flush();
    seedPostWith(em, PostStatus.Published, { wordId: harvest.id });
    seedPostWith(em, PostStatus.Published, { wordId: harbour.id });
    seedPostWith(em, PostStatus.Published, { phraseId: phrase.id });
    seedPostWith(em, PostStatus.Pending, { wordId: draftOnly.id });
    void unused;
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetPostSuggestionsQuery(`ZQX${tag}`, 10),
    );

    expect(view.items).toEqual([
      { type: 'phrase', text: `zqx${tag} at last` },
      { type: 'word', text: `Zqx${tag}-harbour` },
      { type: 'word', text: `zqx${tag}-harvest` },
    ]);
  });

  it('honours the limit, returns nothing for a blank prefix, and treats LIKE wildcards literally', async () => {
    const em = suite.orm.em;
    const tag = randomUUID().slice(0, 8);
    const words = [1, 2, 3].map((n) =>
      factories(em).word.makeOne({ lemma: `wld${tag}-${n}` }),
    );
    await em.flush();
    for (const word of words) {
      seedPostWith(em, PostStatus.Published, { wordId: word.id });
    }
    await em.flush();
    em.clear();

    const limited = await suite.query(
      new GetPostSuggestionsQuery(`wld${tag}`, 2),
    );
    expect(limited.items).toHaveLength(2);

    expect(
      (await suite.query(new GetPostSuggestionsQuery('  ', 5))).items,
    ).toEqual([]);
    expect(
      (await suite.query(new GetPostSuggestionsQuery('%', 5))).items,
    ).toEqual([]);
    expect(
      (await suite.query(new GetPostSuggestionsQuery(`wld${tag}_1`, 5))).items,
    ).toEqual([]);
  });
});
