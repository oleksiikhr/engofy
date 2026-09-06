import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { ReviewLog } from '../../entities/review-log.entity.js';
import { UserSkillProgress } from '../../entities/user-skill-progress.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { ReviewRating } from '../../enums/review-rating.enum.js';
import { CardNotFoundError } from '../../errors/card-not-found.error.js';
import { LearningModule } from '../../learning.module.js';
import { AddCardCommand } from '../add-card/add-card.command.js';
import { ReviewCardCommand } from './review-card.command.js';

describe('ReviewCardHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  async function seedCard(userId: string): Promise<string> {
    const word = suite.orm.em.create(Word, { lemma: `w-${uuidv7()}` });
    await suite.orm.em.flush();
    const card = await suite.command(
      new AddCardCommand(userId, { wordId: word.id }),
    );
    return card.id;
  }

  async function seedGrammarCard(
    userId: string,
    constructionId: string,
  ): Promise<string> {
    const point = suite.orm.em.create(GrammarUsagePoint, {
      constructionId,
      cefrLevel: CefrLevel.B1,
      guideword: 'USE: past perfect',
      canDoStatement: 'Can talk about an earlier past.',
    });
    await suite.orm.em.flush();
    const card = await suite.command(
      new AddCardCommand(userId, { grammarUsagePointId: point.id }),
    );
    return card.id;
  }

  it('reschedules the card and appends a review log', async () => {
    const userId = uuidv7();
    const cardId = await seedCard(userId);

    const card = await suite.command(
      new ReviewCardCommand(userId, cardId, ReviewRating.Good),
    );

    expect(card.reps).toBe(1);
    expect(card.state).not.toBe(LearningCardState.New);
    expect(card.lastReview).not.toBeNull();
    expect(card.due.toMillis()).toBeGreaterThan(DateTime.now().toMillis());

    const logs = await suite.orm.em.find(ReviewLog, { cardId });
    expect(logs).toHaveLength(1);
    expect(logs[0].rating).toBe(ReviewRating.Good);
  });

  it('leaves user_skill_progress untouched for a non-grammar card', async () => {
    const userId = uuidv7();
    const cardId = await seedCard(userId);

    await suite.command(
      new ReviewCardCommand(userId, cardId, ReviewRating.Good),
    );

    expect(await suite.orm.em.count(UserSkillProgress, { userId })).toBe(0);
  });

  it('updates skill progress when a grammar card is reviewed', async () => {
    const userId = uuidv7();
    const constructionId = uuidv7();
    const cardId = await seedGrammarCard(userId, constructionId);

    await suite.command(
      new ReviewCardCommand(userId, cardId, ReviewRating.Good),
    );

    const progress = await suite.orm.em.findOneOrFail(UserSkillProgress, {
      userId,
      constructionId,
    });
    expect(progress.totalAttempts).toBe(1);
    expect(progress.correctAttempts).toBe(1);
    expect(progress.correctStreak).toBe(1);
    // D11: the stored column is no longer maintained — mastery is derived at
    // read time in get-profile (see get-profile.handler.ispec).
    expect(progress.masteryScore).toBe(0);
  });

  it('resets the correct streak on an "Again" grade', async () => {
    const userId = uuidv7();
    const constructionId = uuidv7();
    const cardId = await seedGrammarCard(userId, constructionId);

    await suite.command(
      new ReviewCardCommand(userId, cardId, ReviewRating.Good),
    );
    await suite.command(
      new ReviewCardCommand(userId, cardId, ReviewRating.Again),
    );

    const progress = await suite.orm.em.findOneOrFail(UserSkillProgress, {
      userId,
      constructionId,
    });
    expect(progress.totalAttempts).toBe(2);
    expect(progress.correctAttempts).toBe(1);
    expect(progress.correctStreak).toBe(0);
  });

  it('will not review a card that belongs to another user', async () => {
    const cardId = await seedCard(uuidv7());

    await expect(
      suite.command(new ReviewCardCommand(uuidv7(), cardId, ReviewRating.Good)),
    ).rejects.toBeInstanceOf(CardNotFoundError);
  });

  it('rejects an unknown card id', async () => {
    await expect(
      suite.command(
        new ReviewCardCommand(uuidv7(), uuidv7(), ReviewRating.Again),
      ),
    ).rejects.toBeInstanceOf(CardNotFoundError);
  });
});
