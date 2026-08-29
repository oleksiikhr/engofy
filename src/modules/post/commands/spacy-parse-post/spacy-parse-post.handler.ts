import { EntityManager } from '@mikro-orm/postgresql';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import {
  NLP_CLIENT,
  type NlpClient,
} from '../../../../core/nlp/nlp-client.port.js';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import type { BuiltSentence } from '../../domain/build-sentences.js';
import { buildSentences } from '../../domain/build-sentences.js';
import { flattenPostPartUnits } from '../../domain/flatten.js';
import { upsertPhraseId } from '../../domain/upsert-phrase-id.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { PhraseType } from '../../enums/phrase-type.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import type { PostAiComplexityJobData } from '../assess-complexity/assess-complexity.handler.js';
import { SpacyParsePostCommand } from './spacy-parse-post.command.js';

interface ParsedUnit {
  unitIndex: number;
  sentences: BuiltSentence[];
}

// spaCy analysis stage (PLAN.md §5 `spacy_parse`): for every PostPart, send
// each flattened text unit to the nlp-service and store the returned
// sentences / tokens in `sentences` + `sentence_tokens`. Runs parallel to
// the node-tree annotation stage over the same PostPart plain text (§12) —
// it does not consume or produce node-tree spans.
//
// Idempotency: the stage-level PostPipelineRun row is the source of truth
// (§12). Within a not-yet-completed stage, a part that already has Sentence
// rows is skipped so a crash mid-run doesn't re-parse finished parts — flush
// is once per part, so a part's rows are all-or-nothing.
@CommandHandler(SpacyParsePostCommand)
export class SpacyParsePostHandler
  implements ICommandHandler<SpacyParsePostCommand>
{
  constructor(
    private readonly em: EntityManager,
    @Inject(NLP_CLIENT) private readonly nlp: NlpClient,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(command: SpacyParsePostCommand): Promise<void> {
    const { postId } = command;

    const existingRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.SpacyParse,
    });
    if (existingRun?.status === PostPipelineRunStatus.Completed) {
      return;
    }

    await this.em.findOneOrFail(Post, postId);

    const parts = await this.em.find(
      PostPart,
      { postId },
      { orderBy: { blockIndex: 'asc' } },
    );

    for (const part of parts) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — the per-part flush below must land before the next part so a crash keeps finished parts.
      const alreadyParsed = await this.em.count(Sentence, {
        postPartId: part.id,
      });
      if (alreadyParsed > 0) {
        continue;
      }

      await this.parsePart(part);
      await this.em.flush();
    }

    const run = existingRun ?? new PostPipelineRun();
    run.postId = postId;
    run.stage = PostPipelineStage.SpacyParse;
    run.status = PostPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);

    // Hand off to the next pipeline stage (PLAN.md §5 order). ai_complexity
    // reads the `sentences` this stage just wrote.
    this.outbox.send<PostAiComplexityJobData>(
      this.em,
      QueueName.PostAiComplexity,
      { postId },
      { singletonKey: postId },
    );

    await this.em.flush();
  }

  private async parsePart(part: PostPart): Promise<void> {
    const units = flattenPostPartUnits(part.body);
    const parsed: ParsedUnit[] = [];

    for (const unit of units) {
      if (!unit.text.trim()) {
        continue;
      }
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one nlp-service call at a time keeps the shared em context stable.
      const result = await this.nlp.parse(unit.text);
      parsed.push({
        unitIndex: unit.unitIndex,
        sentences: buildSentences(unit.text, result),
      });
    }

    const phraseIdByKey = await this.resolvePhrasalVerbPhrases(parsed);

    for (const { unitIndex, sentences } of parsed) {
      this.persistUnit(part, unitIndex, sentences, phraseIdByKey);
    }
  }

  // Find-or-creates one Phrase row per distinct phrasal-verb key across the
  // whole part, up front, so persistUnit stays synchronous.
  private async resolvePhrasalVerbPhrases(
    parsed: ParsedUnit[],
  ): Promise<Map<string, string>> {
    const keys = new Set<string>();
    for (const { sentences } of parsed) {
      for (const sentence of sentences) {
        for (const token of sentence.tokens) {
          if (token.phrasalVerbKey) {
            keys.add(token.phrasalVerbKey);
          }
        }
      }
    }

    const phraseIdByKey = new Map<string, string>();
    for (const key of keys) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — each find-or-create must see the previous key's not-yet-flushed Phrase.
      const id = await upsertPhraseId(this.em, key, PhraseType.PhrasalVerb);
      phraseIdByKey.set(key, id);
    }
    return phraseIdByKey;
  }

  private persistUnit(
    part: PostPart,
    unitIndex: number,
    sentences: BuiltSentence[],
    phraseIdByKey: Map<string, string>,
  ): void {
    for (const builtSentence of sentences) {
      const sentence = new Sentence();
      sentence.postId = part.postId;
      sentence.postPartId = part.id;
      sentence.unitIndex = unitIndex;
      sentence.position = builtSentence.position;
      sentence.rawText = builtSentence.rawText;
      sentence.charStart = builtSentence.charStart;
      sentence.charEnd = builtSentence.charEnd;
      this.em.persist(sentence);

      for (const builtToken of builtSentence.tokens) {
        const token = new SentenceToken();
        token.sentenceId = sentence.id;
        token.position = builtToken.position;
        token.text = builtToken.text;
        token.charStart = builtToken.charStart;
        token.charEnd = builtToken.charEnd;
        token.lemma = builtToken.lemma;
        token.pos = builtToken.pos;
        token.tag = builtToken.tag;
        token.dep = builtToken.dep;
        token.headPosition = builtToken.headPosition;
        token.morph = builtToken.morph;
        token.isGerund = builtToken.isGerund;
        token.phrasalVerbGroupId = builtToken.phrasalVerbKey
          ? (phraseIdByKey.get(builtToken.phrasalVerbKey) ?? null)
          : null;
        this.em.persist(token);
      }
    }
  }
}
