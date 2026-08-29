import type { EntityManager } from '@mikro-orm/postgresql';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import {
  AI_CLIENT,
  type AiClient,
  type AiCompleteParams,
} from '../../../../core/ai/ai-client.port.js';
import {
  NLP_CLIENT,
  type NlpClient,
  type NlpParseResult,
  type NlpToken,
} from '../../../../core/nlp/nlp-client.port.js';
import type { Paragraph } from '../../domain/node-tree.types.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { Word } from '../../entities/word.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import { PartOfSpeech } from '../../enums/part-of-speech.enum.js';
import { PhraseType } from '../../enums/phrase-type.enum.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { SpacyLayerMissingError } from '../../errors/spacy-layer-missing.error.js';
import { PostModule } from '../../post.module.js';
import { SpacyParsePostCommand } from '../spacy-parse-post/spacy-parse-post.command.js';
import { AnnotatePostCommand } from './annotate-post.command.js';

const FIXTURE =
  'The government picked up momentum and reporters kept tabs on results';

// Minimal pos/tag/dep for each fixture word — enough to drive the content-POS
// filter in buildTokenAnnotations and the deterministic phrasal-verb grouping
// in build-sentences.ts.
const POS: Record<
  string,
  { pos: string; tag?: string; dep?: string; lemma?: string; head?: number }
> = {
  the: { pos: 'DET', dep: 'det' },
  government: { pos: 'NOUN' },
  picked: { pos: 'VERB', tag: 'VBD', dep: 'ROOT', lemma: 'pick' },
  up: { pos: 'ADP', tag: 'RP', dep: 'prt', head: 2 },
  momentum: { pos: 'NOUN' },
  and: { pos: 'CCONJ', dep: 'cc' },
  reporters: { pos: 'NOUN' },
  kept: { pos: 'VERB', tag: 'VBD', lemma: 'keep' },
  tabs: { pos: 'NOUN' },
  on: { pos: 'ADP', tag: 'IN', dep: 'prep' },
  results: { pos: 'NOUN' },
};

// One sentence = whole input, whitespace tokenised so offsets are exact.
class FakeNlpClient implements NlpClient {
  async parse(text: string): Promise<NlpParseResult> {
    const tokens: NlpToken[] = [];
    const wordRe = /\S+/g;
    let match: RegExpExecArray | null = wordRe.exec(text);
    let index = 0;

    while (match !== null) {
      const raw = match[0];
      const meta = POS[raw.toLowerCase()] ?? { pos: 'X' };
      tokens.push({
        index,
        text: raw,
        lemma: meta.lemma ?? raw.toLowerCase(),
        pos: meta.pos,
        tag: meta.tag ?? 'XX',
        dep: meta.dep ?? 'dep',
        morph: {},
        head: meta.head ?? index,
        start: match.index,
        end: match.index + raw.length,
      });
      index += 1;
      match = wordRe.exec(text);
    }

    return { sentences: [{ text, start: 0, end: text.length, tokens }] };
  }
}

// Wraps the one idiom in the fixture, echoing everything else verbatim so
// parseAnnotationTags sees a complete response and never retries.
class FakeAiClient implements AiClient {
  callCount = 0;

  completeStructured(): Promise<never> {
    throw new Error('completeStructured not used by AnnotatePostHandler');
  }

  async complete({ userText }: AiCompleteParams): Promise<string> {
    this.callCount += 1;
    const phrase = 'kept tabs on';
    const at = userText.indexOf(phrase);
    if (at < 0) {
      return userText;
    }
    return `${userText.slice(0, at)}⟦${phrase}⟧{{p|idiom|keep tabs on|g1}}${userText.slice(
      at + phrase.length,
    )}`;
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

describe('AnnotatePostHandler', () => {
  const fakeAi = new FakeAiClient();
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder
          .overrideProvider(AI_CLIENT)
          .useValue(fakeAi)
          .overrideProvider(NLP_CLIENT)
          .useValue(new FakeNlpClient()),
    },
  );

  async function parseThenAnnotate(text: string): Promise<string> {
    const { postId } = await createPostWithParagraph(suite.orm.em, text);
    await suite.command(new SpacyParsePostCommand(postId));
    await suite.command(new AnnotatePostCommand(postId));
    return postId;
  }

  it('builds word spans from spaCy tokens and links sentence_tokens.word_id', async () => {
    const postId = await parseThenAnnotate(FIXTURE);

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Annotated);

    const part = await suite.orm.em.findOneOrFail(PostPart, { postId });
    expect(part.annotatedAt).not.toBeNull();

    const paragraph = part.body as Paragraph;
    const wordSpans = paragraph.children.filter(
      (n) => n.type === 'span' && n.kind === 'word',
    );
    const wordTexts = wordSpans.map((n) => n.text);
    expect(wordTexts).toContain('government');
    expect(wordTexts).toContain('results');
    // "tabs" is swallowed by the idiom span — no standalone word span.
    expect(wordTexts).not.toContain('tabs');

    const word = await suite.orm.em.findOneOrFail(Word, {
      lemma: 'government',
    });
    await suite.orm.em.findOneOrFail(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });

    const sentence = await suite.orm.em.findOneOrFail(Sentence, { postId });
    const govToken = await suite.orm.em.findOneOrFail(SentenceToken, {
      sentenceId: sentence.id,
      text: 'government',
    });
    expect(govToken.wordId).toBe(word.id);

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.Annotation,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it('splices the AI idiom as a phrase span and marks its tokens is_idiom_part', async () => {
    const postId = await parseThenAnnotate(FIXTURE);

    const phrase = await suite.orm.em.findOneOrFail(Phrase, {
      phraseText: 'keep tabs on',
    });
    expect(phrase.type).toBe(PhraseType.Idiom);

    const part = await suite.orm.em.findOneOrFail(PostPart, { postId });
    const paragraph = part.body as Paragraph;
    const idiomSpan = paragraph.children.find(
      (n) =>
        n.type === 'span' && n.kind === 'phrase' && n.text === 'kept tabs on',
    );
    expect(idiomSpan).toBeDefined();

    const sentence = await suite.orm.em.findOneOrFail(Sentence, { postId });
    const tokens = await suite.orm.em.find(SentenceToken, {
      sentenceId: sentence.id,
      text: { $in: ['kept', 'tabs', 'on'] },
    });
    expect(tokens).toHaveLength(3);
    expect(tokens.every((t) => t.phraseId === phrase.id && t.isIdiomPart)).toBe(
      true,
    );
  });

  it('splices the deterministic phrasal verb and links it back to its Phrase', async () => {
    const postId = await parseThenAnnotate(FIXTURE);

    const phrase = await suite.orm.em.findOneOrFail(Phrase, {
      phraseText: 'pick up',
    });
    expect(phrase.type).toBe(PhraseType.PhrasalVerb);

    const part = await suite.orm.em.findOneOrFail(PostPart, { postId });
    const paragraph = part.body as Paragraph;
    const pvSpans = paragraph.children.filter(
      (n) =>
        n.type === 'span' &&
        n.kind === 'phrase' &&
        (n.text === 'picked' || n.text === 'up'),
    );
    expect(pvSpans).toHaveLength(2);
    expect(
      pvSpans.every(
        (n) =>
          n.type === 'span' && n.kind === 'phrase' && n.phraseId === phrase.id,
      ),
    ).toBe(true);

    const sentence = await suite.orm.em.findOneOrFail(Sentence, { postId });
    const tokens = await suite.orm.em.find(SentenceToken, {
      sentenceId: sentence.id,
      text: { $in: ['picked', 'up'] },
    });
    expect(
      tokens.every(
        (t) =>
          t.phrasalVerbGroupId === phrase.id &&
          t.phraseId === phrase.id &&
          !t.isIdiomPart,
      ),
    ).toBe(true);
  });

  it('is idempotent — a second run does not call the AI again', async () => {
    const { postId } = await createPostWithParagraph(suite.orm.em, FIXTURE);
    await suite.command(new SpacyParsePostCommand(postId));

    await suite.command(new AnnotatePostCommand(postId));
    const callsAfterFirstRun = fakeAi.callCount;

    await suite.command(new AnnotatePostCommand(postId));
    expect(fakeAi.callCount).toBe(callsAfterFirstRun);
  });

  it('fails when the spaCy layer has not run yet', async () => {
    const { postId } = await createPostWithParagraph(suite.orm.em, FIXTURE);

    await expect(
      suite.command(new AnnotatePostCommand(postId)),
    ).rejects.toThrow(SpacyLayerMissingError);
  });
});
