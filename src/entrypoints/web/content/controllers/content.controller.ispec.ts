import type { EntityManager } from '@mikro-orm/postgresql';
import { HttpStatus } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { createWebE2ESuite } from '../../../../../test/http/web/setup/e2e-suite.helper.js';
import { PostSource } from '../../../../modules/post/embeddables/post-source.embeddable.js';
import { Exercise } from '../../../../modules/post/entities/exercise.entity.js';
import { GrammarCategory } from '../../../../modules/post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../../modules/post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../../modules/post/entities/grammar-usage-point.entity.js';
import { Post } from '../../../../modules/post/entities/post.entity.js';
import { PostPart } from '../../../../modules/post/entities/post-part.entity.js';
import { Word } from '../../../../modules/post/entities/word.entity.js';
import { WordDefinition } from '../../../../modules/post/entities/word-definition.entity.js';
import { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import { ExerciseSource } from '../../../../modules/post/enums/exercise-source.enum.js';
import { ExerciseType } from '../../../../modules/post/enums/exercise-type.enum.js';
import { PartOfSpeech } from '../../../../modules/post/enums/part-of-speech.enum.js';
import { PostPartKind } from '../../../../modules/post/enums/post-part-kind.enum.js';
import { PostSourceFormat } from '../../../../modules/post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../../modules/post/enums/post-status.enum.js';
import { ContentWebModule } from '../content-web.module.js';

interface SeededPost {
  shortId: string;
  slug: string;
  wordDefinitionId: string;
}

async function seedPublishedPost(em: EntityManager): Promise<SeededPost> {
  const word = em.create(Word, { lemma: `travel-${uuidv7().slice(0, 8)}` });
  const definition = em.create(WordDefinition, {
    wordId: word.id,
    pos: PartOfSpeech.Verb,
    definition: 'to go from one place to another',
    cefrLevel: CefrLevel.A2,
  });

  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'She loves to travel widely.';
  source.link = 'https://example.com/article';

  const post = new Post();
  post.source = source;
  post.title = 'A Short Trip';
  post.slug = 'a-short-trip';
  post.status = PostStatus.Published;
  post.cefrLevel = CefrLevel.A2;
  em.persist(post);

  em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'She loves to ' },
        {
          type: 'span',
          kind: 'word',
          text: 'travel',
          wordDefinitionId: definition.id,
          pos: 'VERB',
        },
        { type: 'text', text: ' widely.' },
      ],
    },
  });

  em.create(Exercise, {
    postId: post.id,
    type: ExerciseType.FillBlank,
    source: ExerciseSource.Spacy,
    payload: {
      sentenceId: uuidv7(),
      prompt: 'She loves to ____ widely.',
      answer: 'travel',
    },
  });

  await em.flush();
  return {
    shortId: post.shortId,
    slug: 'a-short-trip',
    wordDefinitionId: definition.id,
  };
}

async function seedGrammar(em: EntityManager): Promise<string> {
  const slug = `present-simple-${uuidv7().slice(0, 8)}`;
  const category = em.create(GrammarCategory, {
    name: `PRESENT-${uuidv7().slice(0, 8)}`,
    sortOrder: 1,
  });
  const construction = em.create(GrammarConstruction, {
    categoryId: category.id,
    name: 'present simple',
    slug,
    cheatSheetContent: '## Form\nSubject + base verb',
    sortOrder: 1,
  });
  em.create(GrammarUsagePoint, {
    constructionId: construction.id,
    cefrLevel: CefrLevel.A1,
    guideword: 'USE: HABITS AND GENERAL FACTS',
    canDoStatement: 'Can describe routines.',
    exampleText: 'I get up at seven.',
  });
  await em.flush();
  return slug;
}

describe('ContentController', () => {
  const suite = createWebE2ESuite({ imports: [ContentWebModule] });

  it('lists a published post in the feed with an excerpt', async () => {
    const { shortId } = await seedPublishedPost(suite.orm.em);

    const res = await suite.request('get', '/feed').expect(HttpStatus.OK);

    const item = res.body.items.find(
      (entry: { shortId: string }) => entry.shortId === shortId,
    );
    expect(item).toMatchObject({ title: 'A Short Trip', cefrLevel: 'A2' });
    expect(item.excerpt).toContain('travel');
  });

  it('returns a post with its node tree, resolved annotations and exercises', async () => {
    const { shortId, slug, wordDefinitionId } = await seedPublishedPost(
      suite.orm.em,
    );

    const res = await suite
      .request('get', `/posts/${slug}-${shortId}`)
      .expect(HttpStatus.OK);

    expect(res.body.doc.type).toBe('doc');
    expect(res.body.annotations.words[wordDefinitionId]).toMatchObject({
      pos: 'verb',
      definition: 'to go from one place to another',
      cefrLevel: 'A2',
    });
    expect(res.body.exercises).toHaveLength(1);
    expect(res.body.sourceLink).toBe('https://example.com/article');
  });

  it('accepts a bare short id and 404s an unknown post', async () => {
    const { shortId } = await seedPublishedPost(suite.orm.em);

    await suite.request('get', `/posts/${shortId}`).expect(HttpStatus.OK);
    await suite
      .request('get', '/posts/a-day-with-no-id')
      .expect(HttpStatus.NOT_FOUND);
    await suite.request('get', '/posts/Zzz00000').expect(HttpStatus.NOT_FOUND);
  });

  it('does not expose a non-published post', async () => {
    const em = suite.orm.em;
    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'draft';
    const post = new Post();
    post.source = source;
    post.slug = 'draft';
    post.status = PostStatus.Annotated;
    em.persist(post);
    await em.flush();

    await suite
      .request('get', `/posts/draft-${post.shortId}`)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('serves the grammar reference and a single construction', async () => {
    const slug = await seedGrammar(suite.orm.em);

    const index = await suite.request('get', '/grammar').expect(HttpStatus.OK);
    const category = index.body.categories.find(
      (c: { constructions: { slug: string }[] }) =>
        c.constructions.some((con) => con.slug === slug),
    );
    expect(category).toBeTruthy();
    expect(
      category.constructions.find((c: { slug: string }) => c.slug === slug),
    ).toMatchObject({ cefrLevel: 'A1', usagePointCount: 1 });

    const detail = await suite
      .request('get', `/grammar/${slug}`)
      .expect(HttpStatus.OK);
    expect(detail.body).toMatchObject({
      name: 'present simple',
      cefrLevel: 'A1',
    });
    expect(detail.body.usagePoints).toHaveLength(1);
    expect(detail.body.cheatSheetContent).toContain('Form');
  });

  it('filters the grammar reference by CEFR level', async () => {
    const slug = await seedGrammar(suite.orm.em);

    const kept = await suite.request('get', '/grammar?cefr=A1');
    expect(
      kept.body.categories.some((c: { constructions: { slug: string }[] }) =>
        c.constructions.some((con) => con.slug === slug),
      ),
    ).toBe(true);

    const dropped = await suite.request('get', '/grammar?cefr=C2');
    expect(
      dropped.body.categories.some((c: { constructions: { slug: string }[] }) =>
        c.constructions.some((con) => con.slug === slug),
      ),
    ).toBe(false);
  });

  it('404s an unknown construction slug', async () => {
    await suite
      .request('get', '/grammar/no-such-slug')
      .expect(HttpStatus.NOT_FOUND);
  });
});
