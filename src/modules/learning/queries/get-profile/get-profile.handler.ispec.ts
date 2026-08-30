import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { GrammarCategory } from '../../../post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PartOfSpeech } from '../../../post/enums/part-of-speech.enum.js';
import { AddCardCommand } from '../../commands/add-card/add-card.command.js';
import { ReviewCardCommand } from '../../commands/review-card/review-card.command.js';
import { UserSkillProgress } from '../../entities/user-skill-progress.entity.js';
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
    const present = em.create(GrammarCategory, {
      name: 'PRESENT',
      sortOrder: 1,
    });
    const past = em.create(GrammarCategory, { name: 'PAST', sortOrder: 2 });
    const presentSimple = em.create(GrammarConstruction, {
      categoryId: present.id,
      name: 'present simple',
      slug: 'present-present-simple',
      sortOrder: 1,
    });
    const pastPerfect = em.create(GrammarConstruction, {
      categoryId: past.id,
      name: 'past perfect',
      slug: 'past-past-perfect',
      sortOrder: 2,
    });
    const presentSimplePoint = em.create(GrammarUsagePoint, {
      constructionId: presentSimple.id,
      cefrLevel: CefrLevel.A2,
      guideword: 'USE: habits',
      canDoStatement: 'Can describe habits.',
    });
    em.create(GrammarUsagePoint, {
      constructionId: presentSimple.id,
      cefrLevel: CefrLevel.B1,
      guideword: 'USE: general truths',
      canDoStatement: 'Can state general truths.',
    });
    const pastPerfectPoint = em.create(GrammarUsagePoint, {
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
    const userId = uuidv7();
    const catalog = await seedCatalog(em);

    const word = em.create(Word, { lemma: `w-${uuidv7()}` });
    await em.flush();
    em.create(WordDefinition, {
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
    await suite.command(new AddCardCommand(userId, { wordId: word.id }));
    await suite.command(
      new ReviewCardCommand(userId, grammarCard.id, ReviewRating.Good),
    );
    em.clear();

    const profile = await suite.query(new GetProfileQuery(userId));

    expect(profile.streak).toBe(1);
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

  // D11: mastery is computed from live FSRS card state on every read, so a
  // stale (or never-written) stored column never reaches the response.
  it('derives masteryScore at read time, ignoring the stored column', async () => {
    const em = suite.orm.em;
    const userId = uuidv7();
    const catalog = await seedCatalog(em);

    const card = await suite.command(
      new AddCardCommand(userId, {
        grammarUsagePointId: catalog.presentSimplePointId,
      }),
    );
    await suite.command(
      new ReviewCardCommand(userId, card.id, ReviewRating.Easy),
    );

    // recordGrammarReview no longer maintains the column — poison it to prove
    // the read path does not trust it.
    const progress = await em.findOneOrFail(UserSkillProgress, { userId });
    expect(progress.masteryScore).toBe(0);
    progress.masteryScore = 999;
    await em.flush();
    em.clear();

    const profile = await suite.query(new GetProfileQuery(userId));
    const presentSimple = profile.categories
      .flatMap((c) => c.constructions)
      .find((c) => c.slug === 'present-present-simple');

    expect(presentSimple?.masteryScore).toBeGreaterThan(0);
    expect(presentSimple?.masteryScore).toBeLessThanOrEqual(100);
  });
});
