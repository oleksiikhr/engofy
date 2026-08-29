import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetPracticeQueueQuery } from './get-practice-queue.query.js';

function card(
  em: EntityManager,
  userId: string,
  due: DateTime,
  target: Partial<
    Pick<LearningCard, 'wordId' | 'phraseId' | 'grammarUsagePointId'>
  >,
): void {
  em.create(LearningCard, {
    userId,
    wordId: target.wordId ?? null,
    phraseId: target.phraseId ?? null,
    grammarUsagePointId: target.grammarUsagePointId ?? null,
    due,
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: LearningCardState.New,
  });
}

describe('GetPracticeQueueHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns only due cards, soonest first, with resolved display text', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();

    const word = em.create(Word, { lemma: 'ephemeral' });
    const phrase = em.create(Phrase, { phraseText: 'pick up' });
    const grammar = em.create(GrammarUsagePoint, {
      constructionId: uuidv7(),
      cefrLevel: CefrLevel.B1,
      guideword: 'past perfect',
      canDoStatement: 'Can talk about an earlier past.',
    });
    await em.flush();

    card(em, userId, DateTime.now().minus({ days: 2 }), { wordId: word.id });
    card(em, userId, DateTime.now().minus({ hours: 1 }), {
      phraseId: phrase.id,
    });
    card(em, userId, DateTime.now().plus({ days: 1 }), {
      grammarUsagePointId: grammar.id,
    });
    await em.flush();
    em.clear();

    const queue = await suite.query(new GetPracticeQueueQuery(userId, 20));

    expect(queue.map((item) => item.target.type)).toEqual(['word', 'phrase']);
    expect(queue[0].target.primary).toBe('ephemeral');
    expect(queue[1].target.primary).toBe('pick up');
  });

  it('caps the queue at the requested limit', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();

    const words = Array.from({ length: 5 }, () =>
      em.create(Word, { lemma: `w-${uuidv7()}` }),
    );
    await em.flush();

    words.forEach((word, i) => {
      card(em, userId, DateTime.now().minus({ minutes: i + 1 }), {
        wordId: word.id,
      });
    });
    await em.flush();
    em.clear();

    const queue = await suite.query(new GetPracticeQueueQuery(userId, 3));
    expect(queue).toHaveLength(3);
  });
});
