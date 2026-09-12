import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { FakeAiClient } from '../../../../../test/fakes/ai.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AI_CLIENT } from '../../../../core/ai/ai-client.port.js';
import type { EnrichmentResult } from '../../domain/enrichment-prompt.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Word } from '../../entities/word.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PartOfSpeech } from '../../enums/part-of-speech.enum.js';
import { PhraseType } from '../../enums/phrase-type.enum.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostModule } from '../../post.module.js';
import { EnrichLexiconCommand } from './enrich-lexicon.command.js';

// Echoes back a fixed entry for every [index] the handler sent under WORDS /
// PHRASES, same shape as assess-complexity's fixtureAssessment.
function fixtureEnrichment(userText: string): EnrichmentResult {
  const [wordsBlock, phrasesBlock] = userText.split('PHRASES:');
  const indexesOf = (block: string) =>
    [...block.matchAll(/^\[(\d+)]/gm)].map((m) => Number(m[1]));

  return {
    words: indexesOf(wordsBlock).map((index) => ({
      index,
      definition: `definition-${index}`,
      phonetic: `/p${index}/`,
      example: `example-${index}`,
      cefrLevel: CefrLevel.A2,
    })),
    phrases: indexesOf(phrasesBlock ?? '').map((index) => ({
      index,
      definition: `phrase-definition-${index}`,
      example: `phrase-example-${index}`,
      cefrLevel: CefrLevel.B1,
    })),
  };
}

interface Fixture {
  postId: string;
  wordDefinitionId: string;
  phraseId: string;
}

// One post whose node tree references one word span and one phrase span,
// both still unenriched (definition null) — mirrors the seedPublishedPost
// fixture in get-post-detail.handler.ispec.ts.
async function seedPost(em: EntityManager): Promise<Fixture> {
  const word = em.create(Word, { lemma: `run-${uuidv7().slice(0, 8)}` });
  const definition = em.create(WordDefinition, {
    wordId: word.id,
    pos: PartOfSpeech.Verb,
  });
  const phrase = em.create(Phrase, {
    phraseText: `give up ${uuidv7().slice(0, 8)}`,
    type: PhraseType.PhrasalVerb,
  });

  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'She runs and gives up.';

  const post = new Post();
  post.source = source;
  em.persist(post);

  em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'She ' },
        {
          type: 'span',
          kind: 'word',
          text: 'runs',
          wordDefinitionId: definition.id,
          pos: 'VERB',
        },
        { type: 'text', text: ' and ' },
        {
          type: 'span',
          kind: 'phrase',
          text: 'gives up',
          phraseId: phrase.id,
        },
        { type: 'text', text: '.' },
      ],
    },
  });

  await em.flush();
  return {
    postId: post.id,
    wordDefinitionId: definition.id,
    phraseId: phrase.id,
  };
}

describe('EnrichLexiconHandler', () => {
  const fakeAi = new FakeAiClient();
  fakeAi.onCompleteStructured = ({ userText }) =>
    fixtureEnrichment(userText as string);
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(AI_CLIENT).useValue(fakeAi),
    },
  );

  it('fills every pending word/phrase and completes the run', async () => {
    const { postId, wordDefinitionId, phraseId } = await seedPost(suite.orm.em);

    await suite.command(new EnrichLexiconCommand(postId));

    const definition = await suite.orm.em.findOneOrFail(
      WordDefinition,
      wordDefinitionId,
    );
    expect(definition.definition).toBe('definition-0');
    expect(definition.phonetic).toBe('/p0/');
    expect(definition.exampleSentence).toBe('example-0');
    expect(definition.cefrLevel).toBe(CefrLevel.A2);

    const phrase = await suite.orm.em.findOneOrFail(Phrase, phraseId);
    expect(phrase.definition).toBe('phrase-definition-0');
    expect(phrase.exampleSentence).toBe('phrase-example-0');
    expect(phrase.cefrLevel).toBe(CefrLevel.B1);

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.Enrichment,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it('is idempotent — a second run does not call the AI again', async () => {
    const { postId } = await seedPost(suite.orm.em);

    await suite.command(new EnrichLexiconCommand(postId));
    const callsAfterFirstRun = fakeAi.structuredCallCount;

    await suite.command(new EnrichLexiconCommand(postId));

    expect(fakeAi.structuredCallCount).toBe(callsAfterFirstRun);
  });

  it('skips the AI call entirely when nothing is pending', async () => {
    const word = suite.orm.em.create(Word, {
      lemma: `already-${uuidv7().slice(0, 8)}`,
    });
    const definition = suite.orm.em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      definition: 'already enriched',
      exampleSentence: 'Already an example.',
      cefrLevel: CefrLevel.A1,
    });

    const source = new PostSource();
    source.format = PostSourceFormat.Text;
    source.rawText = 'A word.';
    const post = new Post();
    post.source = source;
    suite.orm.em.persist(post);

    suite.orm.em.create(PostPart, {
      postId: post.id,
      blockIndex: 0,
      kind: PostPartKind.Paragraph,
      body: {
        type: 'paragraph',
        children: [
          {
            type: 'span',
            kind: 'word',
            text: 'word',
            wordDefinitionId: definition.id,
            pos: 'NOUN',
          },
          { type: 'text', text: '.' },
        ],
      },
    });
    await suite.orm.em.flush();

    const callsBefore = fakeAi.structuredCallCount;
    await suite.command(new EnrichLexiconCommand(post.id));

    expect(fakeAi.structuredCallCount).toBe(callsBefore);
    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId: post.id,
      stage: PostPipelineStage.Enrichment,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });
});
