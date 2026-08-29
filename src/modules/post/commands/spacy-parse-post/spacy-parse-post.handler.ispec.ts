import type { EntityManager } from '@mikro-orm/postgresql';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import {
  NLP_CLIENT,
  type NlpClient,
  type NlpParseResult,
  type NlpToken,
} from '../../../../core/nlp/nlp-client.port.js';
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

const LEMMA_OVERRIDES: Record<string, string> = { picked: 'pick' };
const TAG_OVERRIDES: Record<string, { pos: string; tag: string; dep: string }> =
  {
    picked: { pos: 'VERB', tag: 'VBD', dep: 'ROOT' },
    up: { pos: 'ADP', tag: 'RP', dep: 'prt' },
    swimming: { pos: 'NOUN', tag: 'NN', dep: 'nsubj' },
  };

// Tokenises on whitespace so char offsets are always exact, then stamps a
// few known words with the pos/tag/dep the handler's deterministic rules
// key off (phrasal-verb particle, gerund subject). One sentence = whole
// input.
class FakeNlpClient implements NlpClient {
  callCount = 0;

  async parse(text: string): Promise<NlpParseResult> {
    this.callCount += 1;

    const tokens: NlpToken[] = [];
    const wordRe = /\S+/g;
    let match: RegExpExecArray | null = wordRe.exec(text);
    let index = 0;
    let verbIndex = 0;

    while (match !== null) {
      const raw = match[0];
      const override = TAG_OVERRIDES[raw];
      if (raw === 'picked') {
        verbIndex = index;
      }
      tokens.push({
        index,
        text: raw,
        lemma: LEMMA_OVERRIDES[raw] ?? raw.toLowerCase(),
        pos: override?.pos ?? 'X',
        tag: override?.tag ?? 'XX',
        dep: override?.dep ?? 'dep',
        morph: {},
        head: index,
        start: match.index,
        end: match.index + raw.length,
      });
      index += 1;
      match = wordRe.exec(text);
    }

    for (const token of tokens) {
      if (token.text === 'up' || token.text === 'swimming') {
        token.head = token.text === 'up' ? verbIndex : tokens.length - 1;
      }
    }

    return { sentences: [{ text, start: 0, end: text.length, tokens }] };
  }
}

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
  const fakeNlp = new FakeNlpClient();
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(NLP_CLIENT).useValue(fakeNlp),
    },
  );

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
