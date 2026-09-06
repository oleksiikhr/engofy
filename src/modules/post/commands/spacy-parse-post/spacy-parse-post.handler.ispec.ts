import type { EntityManager } from '@mikro-orm/postgresql';
import { FakeNlpClient } from '../../../../../test/fakes/nlp.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { NLP_CLIENT } from '../../../../core/nlp/nlp-client.port.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostModule } from '../../post.module.js';
import { SpacyParsePostCommand } from './spacy-parse-post.command.js';

// pos/tag/dep/head the handler's deterministic rules key off, for the one
// FIXTURE below: `picked` is the phrasal-verb root, `up` its particle (head →
// `picked` at index 1), `swimming` the gerund subject (head → `her` at
// index 10). Everything else falls through to the fake's `X`/`XX` defaults.
const NLP_OVERRIDES = {
  picked: { pos: 'VERB', tag: 'VBD', dep: 'ROOT', lemma: 'pick' },
  up: { pos: 'ADP', tag: 'RP', dep: 'prt', head: 1 },
  swimming: { pos: 'NOUN', tag: 'NN', dep: 'nsubj', head: 10 },
};

async function createPostWithParagraph(
  em: EntityManager,
  text: string,
): Promise<{ postId: string; partId: string }> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = text;

  const post = new Post();
  post.source = source;
  em.persist(post);

  const part = new PostPart();
  part.postId = post.id;
  part.blockIndex = 0;
  part.kind = PostPartKind.Paragraph;
  part.body = { type: 'paragraph', children: [{ type: 'text', text }] };
  em.persist(part);

  await em.flush();

  return { postId: post.id, partId: part.id };
}

const FIXTURE = 'She picked her sister up from school and swimming helps her';

describe('SpacyParsePostHandler', () => {
  const fakeNlp = new FakeNlpClient(NLP_OVERRIDES);
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(NLP_CLIENT).useValue(fakeNlp),
    },
  );
  const queue = useQueueSpy(suite);

  it('stores sentences and tokens and completes the pipeline run', async () => {
    const { postId, partId } = await createPostWithParagraph(
      suite.orm.em,
      FIXTURE,
    );

    await suite.command(new SpacyParsePostCommand(postId));

    const sentence = await suite.orm.em.findOneOrFail(Sentence, {
      postPartId: partId,
    });
    expect(sentence.rawText).toBe(FIXTURE);
    expect(sentence.unitIndex).toBe(0);
    expect(sentence.position).toBe(0);
    expect(sentence.postId).toBe(postId);

    const tokenCount = await suite.orm.em.count(SentenceToken, {
      sentenceId: sentence.id,
    });
    expect(tokenCount).toBe(FIXTURE.split(' ').length);

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.SpacyParse,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);

    // Fans out to both downstream branches on completion.
    queue.assertSent<{ postId: string }>(
      QueueName.PostAnnotation,
      (d) => d.postId === postId,
    );
    queue.assertSent<{ postId: string }>(
      QueueName.PostAiComplexity,
      (d) => d.postId === postId,
    );
  });

  it('flags the gerund and groups the discontinuous phrasal verb under one Phrase', async () => {
    const { postId } = await createPostWithParagraph(suite.orm.em, FIXTURE);

    await suite.command(new SpacyParsePostCommand(postId));

    const sentence = await suite.orm.em.findOneOrFail(Sentence, { postId });
    const tokens = await suite.orm.em.find(SentenceToken, {
      sentenceId: sentence.id,
    });
    const byText = (t: string) => tokens.find((tok) => tok.text === t);

    expect(byText('swimming')?.isGerund).toBe(true);
    expect(byText('picked')?.headPosition).toBeNull();

    const picked = byText('picked');
    const up = byText('up');
    expect(picked?.phrasalVerbGroupId).toBeTruthy();
    expect(up?.phrasalVerbGroupId).toBe(picked?.phrasalVerbGroupId);

    const phrase = await suite.orm.em.findOneOrFail(Phrase, {
      phraseText: 'pick up',
    });
    expect(picked?.phrasalVerbGroupId).toBe(phrase.id);
  });

  it('is idempotent — a second run does not call the nlp-service again', async () => {
    const { postId } = await createPostWithParagraph(suite.orm.em, FIXTURE);

    await suite.command(new SpacyParsePostCommand(postId));
    const callsAfterFirstRun = fakeNlp.callCount;

    await suite.command(new SpacyParsePostCommand(postId));

    expect(fakeNlp.callCount).toBe(callsAfterFirstRun);
  });
});
