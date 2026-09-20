import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../../test/factories/factories.js';
import { makeWordDefinition } from '../../../../../test/helpers/reference-data.helper.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PartOfSpeech } from '../../../post/enums/part-of-speech.enum.js';
import { AddCardCommand } from '../../commands/add-card/add-card.command.js';
import { RemoveCardCommand } from '../../commands/remove-card/remove-card.command.js';
import { ReviewCardCommand } from '../../commands/review-card/review-card.command.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { ReviewRating } from '../../enums/review-rating.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetProfileQuery } from './get-profile.query.js';

interface SeededCatalog {
  presentSimplePointId: string;
  pastPerfectPointId: string;
}

describe('GetProfileHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  async function seedCatalog(em: EntityManager): Promise<SeededCatalog> {
    const present = factories(em).grammarCategory.makeOne({
      name: 'PRESENT',
      sortOrder: 1,
    });
    const past = factories(em).grammarCategory.makeOne({
      name: 'PAST',
      sortOrder: 2,
    });
    const presentSimple = factories(em).grammarConstruction.makeOne({
      categoryId: present.id,
      name: 'present simple',
      slug: 'present-present-simple',
      sortOrder: 1,
    });
    const pastPerfect = factories(em).grammarConstruction.makeOne({
      categoryId: past.id,
      name: 'past perfect',
      slug: 'past-past-perfect',
      sortOrder: 2,
    });
    const presentSimplePoint = factories(em).grammarUsagePoint.makeOne({
      constructionId: presentSimple.id,
      cefrLevel: CefrLevel.A2,
      guideword: 'USE: habits',
      canDoStatement: 'Can describe habits.',
    });
    factories(em).grammarUsagePoint.makeOne({
      constructionId: presentSimple.id,
      cefrLevel: CefrLevel.B1,
      guideword: 'USE: general truths',
      canDoStatement: 'Can state general truths.',
    });
    const pastPerfectPoint = factories(em).grammarUsagePoint.makeOne({
      constructionId: pastPerfect.id,
      cefrLevel: CefrLevel.B2,
      guideword: 'USE: earlier past',
      canDoStatement: 'Can refer to an earlier past.',
    });
    await em.flush();
    return {
      presentSimplePointId: presentSimplePoint.id,
      pastPerfectPointId: pastPerfectPoint.id,
    };
  }

  it('returns an empty tree with no unlocked skills for a fresh user', async () => {
    await seedCatalog(suite.orm.em);
    suite.orm.em.clear();

    const profile = await suite.query(new GetProfileQuery(uuidv7()));

    expect(profile.streak).toBe(0);
    expect(profile.activityDays).toEqual([]);
    expect(profile.cefr).toEqual({ A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 });
    expect(profile.categories.map((c) => c.name)).toEqual(['PRESENT', 'PAST']);
    for (const category of profile.categories) {
      for (const construction of category.constructions) {
        expect(construction.locked).toBe(true);
        expect(construction.masteryScore).toBe(0);
      }
    }
    const [presentSimple] = profile.categories[0].constructions;
    expect(presentSimple.cefrLevel).toBe(CefrLevel.A2);
  });

  it('unlocks a reviewed construction, counts the streak and CEFR cards', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;
    const catalog = await seedCatalog(em);

    const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
    await em.flush();
    const definition = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      cefrLevel: CefrLevel.B1,
    });
    await em.flush();

    const grammarCard = await suite.command(
      new AddCardCommand(userId, {
        grammarUsagePointId: catalog.presentSimplePointId,
      }),
    );
    await suite.command(
      new AddCardCommand(userId, { wordDefinitionId: definition.id }),
    );
    await suite.command(
      new ReviewCardCommand(userId, grammarCard.id, ReviewRating.Good),
    );
    em.clear();

    const profile = await suite.query(new GetProfileQuery(userId));

    expect(profile.streak).toBe(1);
    expect(profile.activityDays).toEqual([DateTime.now().toUTC().toISODate()]);
    expect(profile.cefr.A2).toBe(1); // grammar card, at its usage point level
    expect(profile.cefr.B1).toBe(1); // word card, lowest classified definition

    const presentSimple = profile.categories
      .flatMap((c) => c.constructions)
      .find((c) => c.slug === 'present-present-simple');
    const pastPerfect = profile.categories
      .flatMap((c) => c.constructions)
      .find((c) => c.slug === 'past-past-perfect');

    expect(presentSimple?.locked).toBe(false);
    expect(presentSimple?.masteryScore).toBeGreaterThan(0);
    expect(presentSimple?.correctStreak).toBe(1);
    expect(pastPerfect?.locked).toBe(true);
  });

  it('keeps a removed card in the streak but out of the CEFR breakdown', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;

    const word = factories(em).word.makeOne({ lemma: `w-${uuidv7()}` });
    await em.flush();
    const definition = factories(em).wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      cefrLevel: CefrLevel.B1,
    });
    await em.flush();

    const card = await suite.command(
      new AddCardCommand(userId, { wordDefinitionId: definition.id }),
    );
    await suite.command(
      new ReviewCardCommand(userId, card.id, ReviewRating.Good),
    );
    await suite.command(new RemoveCardCommand(userId, card.id));
    em.clear();

    const profile = await suite.query(new GetProfileQuery(userId));

    expect(profile.streak).toBe(1);
    expect(profile.activityDays).toEqual([DateTime.now().toUTC().toISODate()]);
    expect(profile.cefr.B1).toBe(0);
  });

  it('returns every distinct review day across all cards, sorted ascending', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;
    const now = DateTime.now();

    const card = factories(em).learningCard.makeOne({
      userId,
      wordDefinitionId: makeWordDefinition(factories(em)).id,
      due: now,
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 1,
      lapses: 0,
      state: LearningCardState.Learning,
    });
    // Two logs on the same UTC day collapse into one entry; deliberately
    // out of order to prove the result comes back sorted.
    factories(em).reviewLog.makeOne({
      cardId: card.id,
      rating: ReviewRating.Good,
      reviewedAt: now,
      elapsedDays: 0,
      scheduledDays: 1,
    });
    factories(em).reviewLog.makeOne({
      cardId: card.id,
      rating: ReviewRating.Good,
      reviewedAt: now,
      elapsedDays: 0,
      scheduledDays: 1,
    });
    factories(em).reviewLog.makeOne({
      cardId: card.id,
      rating: ReviewRating.Good,
      reviewedAt: now.minus({ days: 3 }),
      elapsedDays: 0,
      scheduledDays: 1,
    });
    await em.flush();
    em.clear();

    const profile = await suite.query(new GetProfileQuery(userId));

    expect(profile.activityDays).toEqual([
      now.minus({ days: 3 }).toUTC().toISODate(),
      now.toUTC().toISODate(),
    ]);
  });

  it('derives masteryScore from live FSRS card state', async () => {
    const em = suite.orm.em;
    const userId = (await suite.factories.user.createOne()).id;
    const catalog = await seedCatalog(em);

    const card = await suite.command(
      new AddCardCommand(userId, {
        grammarUsagePointId: catalog.presentSimplePointId,
      }),
    );
    await suite.command(
      new ReviewCardCommand(userId, card.id, ReviewRating.Easy),
    );

    em.clear();

    const profile = await suite.query(new GetProfileQuery(userId));
    const presentSimple = profile.categories
      .flatMap((c) => c.constructions)
      .find((c) => c.slug === 'present-present-simple');

    expect(presentSimple?.masteryScore).toBeGreaterThan(0);
    expect(presentSimple?.masteryScore).toBeLessThanOrEqual(100);
  });
});
