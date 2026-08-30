import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { GrammarCategory } from '../../post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../post/entities/grammar-usage-point.entity.js';
import { CefrLevel } from '../../post/enums/cefr-level.enum.js';
import type { LearningCard } from '../entities/learning-card.entity.js';
import { UserSkillProgress } from '../entities/user-skill-progress.entity.js';
import { ReviewRating } from '../enums/review-rating.enum.js';
import { LearningModule } from '../learning.module.js';
import { SkillProgressService } from './skill-progress.service.js';

describe('SkillProgressService', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  let service: SkillProgressService;

  beforeAll(() => {
    service = suite.moduleRef.get(SkillProgressService, { strict: false });
  });

  async function seedUsagePoint(em: EntityManager): Promise<{
    usagePointId: string;
    constructionId: string;
  }> {
    const category = em.create(GrammarCategory, {
      name: `cat-${uuidv7()}`,
      sortOrder: 0,
    });
    const construction = em.create(GrammarConstruction, {
      categoryId: category.id,
      name: `con-${uuidv7()}`,
      slug: `con-${uuidv7()}`,
      sortOrder: 0,
    });
    const point = em.create(GrammarUsagePoint, {
      constructionId: construction.id,
      egpIndex: Math.floor(Math.random() * 1_000_000),
      cefrLevel: CefrLevel.B1,
      guideword: 'USE',
      canDoStatement: 'can do',
    });
    await em.flush();
    return { usagePointId: point.id, constructionId: construction.id };
  }

  const gradeCard = (grammarUsagePointId: string | null) =>
    ({ grammarUsagePointId }) as LearningCard;

  it('unlockConstruction creates one progress row and stamps unlockedAt', async () => {
    const userId = uuidv7();
    const { usagePointId, constructionId } = await seedUsagePoint(suite.orm.em);

    await service.unlockConstruction(userId, usagePointId);
    await service.unlockConstruction(userId, usagePointId); // idempotent

    const rows = await suite.orm.em.find(UserSkillProgress, {
      userId,
      constructionId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].unlockedAt).not.toBeNull();
    expect(rows[0].totalAttempts).toBe(0);
  });

  it('unlockConstruction is a no-op for an unknown usage point', async () => {
    const userId = uuidv7();
    await service.unlockConstruction(userId, uuidv7());
    expect(await suite.orm.em.count(UserSkillProgress, { userId })).toBe(0);
  });

  it('recordGrammarReview bumps totals and streak on a correct grade', async () => {
    const userId = uuidv7();
    const { usagePointId, constructionId } = await seedUsagePoint(suite.orm.em);

    await service.recordGrammarReview(
      userId,
      gradeCard(usagePointId),
      ReviewRating.Good,
    );
    await suite.orm.em.flush();

    const row = await suite.orm.em.findOneOrFail(UserSkillProgress, {
      userId,
      constructionId,
    });
    expect(row.totalAttempts).toBe(1);
    expect(row.correctAttempts).toBe(1);
    expect(row.correctStreak).toBe(1);
  });

  it('recordGrammarReview resets the streak on "again"', async () => {
    const userId = uuidv7();
    const { usagePointId, constructionId } = await seedUsagePoint(suite.orm.em);

    // Each review is its own unit of work in production (the facade flushes
    // between commands) — mirror that here.
    await service.recordGrammarReview(
      userId,
      gradeCard(usagePointId),
      ReviewRating.Good,
    );
    await suite.orm.em.flush();
    await service.recordGrammarReview(
      userId,
      gradeCard(usagePointId),
      ReviewRating.Again,
    );
    await suite.orm.em.flush();

    const row = await suite.orm.em.findOneOrFail(UserSkillProgress, {
      userId,
      constructionId,
    });
    expect(row.totalAttempts).toBe(2);
    expect(row.correctAttempts).toBe(1);
    expect(row.correctStreak).toBe(0);
  });

  it('recordGrammarReview is a no-op for a card with no grammar usage point', async () => {
    const userId = uuidv7();
    await service.recordGrammarReview(
      userId,
      gradeCard(null),
      ReviewRating.Good,
    );
    expect(await suite.orm.em.count(UserSkillProgress, { userId })).toBe(0);
  });

  it('never writes masteryScore (derived at read time — D11)', async () => {
    const userId = uuidv7();
    const { usagePointId, constructionId } = await seedUsagePoint(suite.orm.em);

    await service.recordGrammarReview(
      userId,
      gradeCard(usagePointId),
      ReviewRating.Easy,
    );
    await suite.orm.em.flush();

    const row = await suite.orm.em.findOneOrFail(UserSkillProgress, {
      userId,
      constructionId,
    });
    expect(row.masteryScore).toBe(0);
  });
});
