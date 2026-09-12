import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import {
  AI_CLIENT,
  type AiClient,
} from '../../../../core/ai/ai-client.port.js';
import { collectSpanNodes } from '../../domain/collect-spans.js';
import {
  buildEnrichmentUserText,
  ENRICHMENT_SYSTEM_PROMPT,
  enrichmentToolSchema,
  indexEnrichmentResult,
  type PendingPhrase,
  type PendingWord,
} from '../../domain/enrichment-prompt.js';
import { parseDoc } from '../../domain/node-tree.parser.js';
import { assembleDocFromParts } from '../../domain/post-parts.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Word } from '../../entities/word.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { EnrichLexiconCommand } from './enrich-lexicon.command.js';

export interface PostAiEnrichmentJobData {
  postId: string;
}

interface PendingLexicon {
  pendingWords: PendingWord[];
  wordDefs: WordDefinition[];
  pendingPhrases: PendingPhrase[];
  phrases: Phrase[];
}

// enrichment stage (PLAN.md §17 Track A): fills the WordDefinition/Phrase
// stubs `annotate-post` find-or-creates for this post — definition,
// phonetic (words only), example, cefrLevel. Runs as a third branch off the
// annotation stage's completion (alongside ai_complexity), because it needs
// the wordDefinitionId/phraseId links annotation already resolved onto the
// node-tree spans (same source get-post-detail reads).
//
// Idempotency is row-level gap-fill (P6-style, not P6a full-recompute): only
// rows still `definition IS NULL` are sent to the model, and an empty
// pending set completes the stage with zero AI calls — a word/phrase
// enriched by an earlier post is never re-billed. `publish` gates on this
// stage the same way it gates on `annotation` (D6) and `ai_grammar`'s paint
// phase (F3).
@CommandHandler(EnrichLexiconCommand)
export class EnrichLexiconHandler
  implements ICommandHandler<EnrichLexiconCommand>
{
  private readonly logger = new Logger(EnrichLexiconHandler.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
  ) {}

  async execute(command: EnrichLexiconCommand): Promise<void> {
    const { postId } = command;

    const existingRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.Enrichment,
    });
    if (existingRun?.status === PostPipelineRunStatus.Completed) {
      return;
    }

    await this.em.findOneOrFail(Post, postId);

    const { wordDefinitionIds, phraseIds } =
      await this.collectPostLexicon(postId);
    const { pendingWords, wordDefs, pendingPhrases, phrases } =
      await this.loadPending(wordDefinitionIds, phraseIds);

    if (pendingWords.length === 0 && pendingPhrases.length === 0) {
      this.logger.log({ postId }, 'ai_enrichment: nothing pending, skipped');
    } else {
      const assessment = await this.ai.completeStructured({
        system: ENRICHMENT_SYSTEM_PROMPT,
        userText: buildEnrichmentUserText(pendingWords, pendingPhrases),
        tool: {
          name: 'report_enrichment',
          description:
            'Report a learner-dictionary definition, example sentence, CEFR level (and phonetic for words) for every word and phrase listed.',
          schema: enrichmentToolSchema,
        },
      });

      const indexed = indexEnrichmentResult(
        assessment,
        pendingWords.length,
        pendingPhrases.length,
      );

      indexed.words.forEach((entry, i) => {
        const definition = wordDefs[i];
        definition.definition = entry.definition;
        definition.phonetic = entry.phonetic;
        definition.exampleSentence = entry.example;
        definition.cefrLevel = entry.cefrLevel;
      });

      indexed.phrases.forEach((entry, i) => {
        const phrase = phrases[i];
        phrase.definition = entry.definition;
        phrase.exampleSentence = entry.example;
        phrase.cefrLevel = entry.cefrLevel;
      });

      this.logger.log(
        {
          postId,
          words: pendingWords.length,
          phrases: pendingPhrases.length,
        },
        'ai_enrichment filled pending lexicon entries',
      );
    }

    const run = existingRun ?? new PostPipelineRun();
    run.postId = postId;
    run.stage = PostPipelineStage.Enrichment;
    run.status = PostPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);
  }

  // The word/phrase ids this post's node-tree references — the same span
  // source get-post-detail resolves `annotations.words/phrases` from, so
  // "pending for this post" always matches what a reader would see.
  private async collectPostLexicon(
    postId: string,
  ): Promise<{ wordDefinitionIds: string[]; phraseIds: string[] }> {
    const parts = await this.em.find(
      PostPart,
      { postId },
      { orderBy: { blockIndex: 'asc' } },
    );
    const doc = parseDoc(assembleDocFromParts(parts));
    const spans = collectSpanNodes(doc.children);

    return {
      wordDefinitionIds: unique(
        spans.map((span) =>
          span.kind === 'word' ? span.wordDefinitionId : null,
        ),
      ),
      phraseIds: unique(
        spans.map((span) => (span.kind === 'phrase' ? span.phraseId : null)),
      ),
    };
  }

  private async loadPending(
    wordDefinitionIds: string[],
    phraseIds: string[],
  ): Promise<PendingLexicon> {
    const wordDefs =
      wordDefinitionIds.length === 0
        ? []
        : await this.em.find(WordDefinition, {
            id: { $in: wordDefinitionIds },
            definition: null,
          });

    const words =
      wordDefs.length === 0
        ? []
        : await this.em.find(Word, {
            id: { $in: unique(wordDefs.map((def) => def.wordId)) },
          });
    const wordById = new Map(words.map((word) => [word.id, word]));

    const pendingWords: PendingWord[] = wordDefs.map((definition) => ({
      wordDefinitionId: definition.id,
      lemma: wordById.get(definition.wordId)?.lemma ?? '',
      pos: definition.pos,
    }));

    const phrases =
      phraseIds.length === 0
        ? []
        : await this.em.find(Phrase, {
            id: { $in: phraseIds },
            definition: null,
          });

    const pendingPhrases: PendingPhrase[] = phrases.map((phrase) => ({
      phraseId: phrase.id,
      phraseText: phrase.phraseText,
      type: phrase.type ?? null,
    }));

    return { pendingWords, wordDefs, pendingPhrases, phrases };
  }
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}
