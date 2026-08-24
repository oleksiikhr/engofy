import type { EntityManager } from '@mikro-orm/postgresql';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import {
  AI_CLIENT,
  type AiClient,
  type AiToolCallParams,
} from '../../../../core/ai/ai-client.port.js';
import { ContentModule } from '../../content.module.js';
import type { Paragraph } from '../../domain/node-tree.types.js';
import type { Annotation } from '../../domain/validate-annotations.js';
import { ContentSource } from '../../embeddables/content-source.embeddable.js';
import { Content } from '../../entities/content.entity.js';
import { ContentPart } from '../../entities/content-part.entity.js';
import { ContentPipelineRun } from '../../entities/content-pipeline-run.entity.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Word } from '../../entities/word.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import { ContentPartKind } from '../../enums/content-part-kind.enum.js';
import { ContentPipelineRunStatus } from '../../enums/content-pipeline-run-status.enum.js';
import { ContentPipelineStage } from '../../enums/content-pipeline-stage.enum.js';
import { ContentSourceFormat } from '../../enums/content-source-format.enum.js';
import { ContentStatus } from '../../enums/content-status.enum.js';
import { PartOfSpeech } from '../../enums/part-of-speech.enum.js';
import { AnnotateContentCommand } from './annotate-content.command.js';

// Returns fixed annotations by matching substrings in the given text — good
// enough to drive the handler's splice/find-or-create logic deterministically
// without a live API call.
class FakeAiClient implements AiClient {
  callCount = 0;

  async runTool<T>({ userText }: AiToolCallParams): Promise<T> {
    this.callCount += 1;
    const spans: Annotation[] = [];

    const word = (
      form: string,
      lemma: string,
      pos: string,
      cefrLevel: string,
    ) => {
      const start = userText.indexOf(form);
      if (start >= 0) {
        spans.push({
          start,
          end: start + form.length,
          form,
          kind: 'word',
          lemma,
          pos,
          cefrLevel,
        });
      }
    };

    word('government', 'government', PartOfSpeech.Noun, 'B1');

    const tookStart = userText.indexOf('took');
    const offStart = userText.indexOf('off', tookStart);
    if (tookStart >= 0 && offStart >= 0) {
      spans.push(
        {
          start: tookStart,
          end: tookStart + 4,
          form: 'took',
          kind: 'phrase',
          phraseText: 'take off',
          phraseType: 'phrasal_verb',
          phraseGroupId: 'g1',
          cefrLevel: 'A2',
        },
        {
          start: offStart,
          end: offStart + 3,
          form: 'off',
          kind: 'phrase',
          phraseText: 'take off',
          phraseType: 'phrasal_verb',
          phraseGroupId: 'g1',
          cefrLevel: 'A2',
        },
      );
    }

    return { spans } as T;
  }
}

async function createContentWithParagraph(
  em: EntityManager,
  text: string,
): Promise<{ contentId: string; partId: string }> {
  const source = new ContentSource();
  source.format = ContentSourceFormat.Text;
  source.rawText = text;

  const content = new Content();
  content.source = source;
  em.persist(content);

  const part = new ContentPart();
  part.contentId = content.id;
  part.blockIndex = 0;
  part.kind = ContentPartKind.Paragraph;
  part.body = { type: 'paragraph', children: [{ type: 'text', text }] };
  em.persist(part);

  await em.flush();

  return { contentId: content.id, partId: part.id };
}

describe('AnnotateContentHandler', () => {
  const fakeAi = new FakeAiClient();
  const suite = createIntegrationSuite(
    { imports: [ContentModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(AI_CLIENT).useValue(fakeAi),
    },
  );

  it('annotates a word, creating Word/WordDefinition and completing the pipeline run', async () => {
    const { contentId, partId } = await createContentWithParagraph(
      suite.orm.em,
      'The government announced new rules.',
    );

    await suite.command(new AnnotateContentCommand(contentId));

    const content = await suite.orm.em.findOneOrFail(Content, contentId);
    expect(content.status).toBe(ContentStatus.Annotated);

    const part = await suite.orm.em.findOneOrFail(ContentPart, partId);
    expect(part.annotatedAt).not.toBeNull();
    const paragraph = part.body as Paragraph;
    const spanNode = paragraph.children.find((node) => node.type === 'span');
    expect(spanNode?.text).toBe('government');

    const word = await suite.orm.em.findOneOrFail(Word, {
      lemma: 'government',
    });
    const definition = await suite.orm.em.findOneOrFail(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    expect(definition.cefrLevel).toBe('B1');

    const run = await suite.orm.em.findOneOrFail(ContentPipelineRun, {
      contentId,
      stage: ContentPipelineStage.Annotation,
    });
    expect(run.status).toBe(ContentPipelineRunStatus.Completed);
  });

  it("groups a non-adjacent phrase's fragments under one Phrase via phraseGroupId", async () => {
    const { contentId } = await createContentWithParagraph(
      suite.orm.em,
      'She took her coat off before dinner.',
    );

    await suite.command(new AnnotateContentCommand(contentId));

    const phrase = await suite.orm.em.findOneOrFail(Phrase, {
      phraseText: 'take off',
    });

    const parts = await suite.orm.em.find(ContentPart, { contentId });
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
    const { contentId } = await createContentWithParagraph(
      suite.orm.em,
      'The government announced new rules.',
    );

    await suite.command(new AnnotateContentCommand(contentId));
    const callsAfterFirstRun = fakeAi.callCount;

    await suite.command(new AnnotateContentCommand(contentId));

    expect(fakeAi.callCount).toBe(callsAfterFirstRun);
  });
});
