import type { EntityManager } from '@mikro-orm/postgresql';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import {
  AI_CLIENT,
  type AiClient,
  type AiCompleteParams,
} from '../../../../core/ai/ai-client.port.js';
import type { Paragraph } from '../../domain/node-tree.types.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Word } from '../../entities/word.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import { PartOfSpeech } from '../../enums/part-of-speech.enum.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { AnnotatePostCommand } from './annotate-post.command.js';

interface Insertion {
  at: number;
  text: string;
}

// Inserts each tag at its exact character offset and leaves every other
// character untouched, applied back-to-front so earlier offsets stay valid
// as later ones are inserted. This matters beyond just producing the right
// tags: parseAnnotationTags treats a response as complete only if stripping
// its tags reconstructs the original text character-for-character, so any
// insertion scheme that shifted untagged text would make the handler
// believe the fake's response was truncated and trigger its one retry.
function insertAll(text: string, insertions: Insertion[]): string {
  const sorted = [...insertions].sort((a, b) => b.at - a.at);
  return sorted.reduce(
    (acc, { at, text: insertText }) =>
      acc.slice(0, at) + insertText + acc.slice(at),
    text,
  );
}

// Hand-tags the two fixture sentences this ispec uses — good enough to
// drive the handler's splice/find-or-create logic deterministically without
// a live API call.
class FakeAiClient implements AiClient {
  callCount = 0;

  async complete({ userText }: AiCompleteParams): Promise<string> {
    this.callCount += 1;

    const insertions: Insertion[] = [];

    const govStart = userText.indexOf('government');
    if (govStart >= 0) {
      insertions.push({
        at: govStart + 'government'.length,
        text: `{{w|${PartOfSpeech.Noun}|government}}`,
      });
    }

    const tookStart = userText.indexOf('took');
    const offStart = userText.indexOf('off', tookStart);
    if (tookStart >= 0 && offStart >= 0) {
      insertions.push(
        { at: tookStart, text: '⟦' },
        {
          at: tookStart + 'took'.length,
          text: '⟧{{p|phrasal_verb|take off|g1}}',
        },
        { at: offStart, text: '⟦' },
        {
          at: offStart + 'off'.length,
          text: '⟧{{p|phrasal_verb|take off|g1}}',
        },
      );
    }

    return insertAll(userText, insertions);
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
        builder.overrideProvider(AI_CLIENT).useValue(fakeAi),
    },
  );

  it('annotates a word, creating Word/WordDefinition and completing the pipeline run', async () => {
    const { postId, partId } = await createPostWithParagraph(
      suite.orm.em,
      'The government announced new rules.',
    );

    await suite.command(new AnnotatePostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Annotated);

    const part = await suite.orm.em.findOneOrFail(PostPart, partId);
    expect(part.annotatedAt).not.toBeNull();
    const paragraph = part.body as Paragraph;
    const spanNode = paragraph.children.find((node) => node.type === 'span');
    expect(spanNode?.text).toBe('government');

    const word = await suite.orm.em.findOneOrFail(Word, {
      lemma: 'government',
    });
    await suite.orm.em.findOneOrFail(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.Annotation,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it("groups a non-adjacent phrase's fragments under one Phrase via phraseGroupId", async () => {
    const { postId } = await createPostWithParagraph(
      suite.orm.em,
      'She took her coat off before dinner.',
    );

    await suite.command(new AnnotatePostCommand(postId));

    const phrase = await suite.orm.em.findOneOrFail(Phrase, {
      phraseText: 'take off',
    });

    const parts = await suite.orm.em.find(PostPart, { postId });
    const paragraph = parts[0]?.body as Paragraph;
    const phraseSpans = paragraph.children.filter(
      (node) => node.type === 'span' && node.kind === 'phrase',
    );
    expect(phraseSpans).toHaveLength(2);
    expect(
      phraseSpans.every(
        (node) =>
          node.type === 'span' &&
          node.kind === 'phrase' &&
          node.phraseId === phrase.id,
      ),
    ).toBe(true);
  });

  it('is idempotent — a second run does not call the AI again', async () => {
    const { postId } = await createPostWithParagraph(
      suite.orm.em,
      'The government announced new rules.',
    );

    await suite.command(new AnnotatePostCommand(postId));
    const callsAfterFirstRun = fakeAi.callCount;

    await suite.command(new AnnotatePostCommand(postId));

    expect(fakeAi.callCount).toBe(callsAfterFirstRun);
  });
});
