import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { FakeAiClient } from '../../../../../test/fakes/ai.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AI_CLIENT } from '../../../../core/ai/ai-client.port.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostModule } from '../../post.module.js';
import { TagGrammarCommand } from './tag-grammar.command.js';

const SENTENCE_TEXT = 'She had never visited Tokyo before.';
// token position -> [charStart, charEnd, text]
const TOKEN_SPEC: [number, number, string][] = [
  [0, 3, 'She'],
  [4, 7, 'had'],
  [8, 13, 'never'],
  [14, 21, 'visited'],
  [22, 27, 'Tokyo'],
  [28, 34, 'before'],
  [34, 35, '.'],
];

const DEFAULT_GRAMMAR_RESPONSE = `[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before.`;

async function seedCatalog(em: EntityManager): Promise<void> {
  const category = new GrammarCategory();
  category.name = 'PAST';
  category.sortOrder = 0;
  em.persist(category);

  const construction = new GrammarConstruction();
  construction.categoryId = category.id;
  construction.name = 'past perfect';
  construction.slug = 'past-perfect';
  construction.sortOrder = 0;
  em.persist(construction);

  for (const [egpIndex, cefr] of [
    [412, CefrLevel.B1],
    [999, CefrLevel.B2],
  ] as const) {
    const usagePoint = new GrammarUsagePoint();
    usagePoint.constructionId = construction.id;
    usagePoint.egpIndex = egpIndex;
    usagePoint.cefrLevel = cefr;
    usagePoint.guideword = `USE ${egpIndex}`;
    usagePoint.canDoStatement = `can do ${egpIndex}`;
    em.persist(usagePoint);
  }

  await em.flush();
}

async function seedPostWithSentence(em: EntityManager): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = SENTENCE_TEXT;
  const post = new Post();
  post.source = source;
  em.persist(post);

  const sentence = new Sentence();
  sentence.postId = post.id;
  sentence.postPartId = uuidv7();
  sentence.unitIndex = 0;
  sentence.position = 0;
  sentence.rawText = SENTENCE_TEXT;
  sentence.charStart = 0;
  sentence.charEnd = SENTENCE_TEXT.length;
  em.persist(sentence);

  TOKEN_SPEC.forEach(([charStart, charEnd, text], position) => {
    const token = new SentenceToken();
    token.sentenceId = sentence.id;
    token.position = position;
    token.text = text;
    token.charStart = charStart;
    token.charEnd = charEnd;
    token.lemma = text.toLowerCase();
    token.pos = 'X';
    token.tag = 'XX';
    token.dep = 'dep';
    token.morph = {};
    em.persist(token);
  });

  await em.flush();
  return post.id;
}

describe('TagGrammarHandler', () => {
  const fakeAi = new FakeAiClient();
  let grammarResponse = DEFAULT_GRAMMAR_RESPONSE;
  fakeAi.onComplete = () => grammarResponse;
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(AI_CLIENT).useValue(fakeAi),
    },
  );

  beforeEach(() => {
    grammarResponse = DEFAULT_GRAMMAR_RESPONSE;
  });

  it('writes a grammar_match with the token range and resolved usage point', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);

    await suite.command(new TagGrammarCommand(postId));

    const usagePoint = await suite.orm.em.findOneOrFail(GrammarUsagePoint, {
      egpIndex: 412,
    });
    const matches = await suite.orm.em.find(GrammarMatch, {});
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      grammarUsagePointId: usagePoint.id,
      tokenStart: 1,
      tokenEnd: 4,
    });

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.AiGrammar,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it('drops a span whose usage-point index does not belong to the tagged construction', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);
    grammarResponse = `[0] She ⟦had never visited⟧{{g|past-perfect|11111}} Tokyo before.`;

    await suite.command(new TagGrammarCommand(postId));

    expect(await suite.orm.em.count(GrammarMatch, {})).toBe(0);
  });

  it('dedupes an identical span the model repeats instead of failing on the unique constraint', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);
    grammarResponse =
      `[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before.\n` +
      `[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before.`;

    await suite.command(new TagGrammarCommand(postId));

    expect(await suite.orm.em.count(GrammarMatch, {})).toBe(1);
  });

  it('is idempotent — a second run neither re-calls the AI nor duplicates matches', async () => {
    await seedCatalog(suite.orm.em);
    const postId = await seedPostWithSentence(suite.orm.em);

    await suite.command(new TagGrammarCommand(postId));
    const callsAfterFirstRun = fakeAi.completeCallCount;

    await suite.command(new TagGrammarCommand(postId));

    expect(fakeAi.completeCallCount).toBe(callsAfterFirstRun);
    expect(await suite.orm.em.count(GrammarMatch, {})).toBe(1);
  });
});
