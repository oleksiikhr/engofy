import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../../test/factories/factories.js';
import { makeGrammarUsagePoint } from '../../../../../test/helpers/reference-data.helper.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { User } from '../../../auth/entities/user.entity.js';
import { Disposition } from '../../../learning/enums/disposition.enum.js';
import { LearningCardState } from '../../../learning/enums/learning-card-state.enum.js';
import { Post } from '../../../post/entities/post.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import { NoPostAvailableError } from '../../errors/no-post-available.error.js';
import { HomeModule } from '../../home.module.js';
import { SelectDailyPlanCandidateQuery } from './select-daily-plan-candidate.query.js';

async function seedUser(
  em: EntityManager,
  cefrLevel: CefrLevel = CefrLevel.A1,
): Promise<User> {
  const user = factories(em).user.makeOne({
    email: `${uuidv7()}@example.com`,
    cefrLevel,
  });
  await em.flush();
  return user;
}

async function seedPost(
  em: EntityManager,
  opts: {
    cefrLevel: CefrLevel;
    publishedAt: DateTime;
    status?: PostStatus;
  },
): Promise<Post> {
  const post = factories(em).post.makeOne({
    source: { format: PostSourceFormat.Text, rawText: 'Some text.' },
    status: opts.status ?? PostStatus.Published,
    cefrLevel: opts.cefrLevel,
    publishedAt: opts.publishedAt,
  });
  await em.flush();
  return post;
}

async function markRead(
  em: EntityManager,
  userId: string,
  postId: string,
): Promise<void> {
  factories(em).postRead.makeOne({ userId, postId, readAt: DateTime.now() });
  await em.flush();
}

describe('SelectDailyPlanCandidateHandler', () => {
  const suite = createIntegrationSuite({ imports: [HomeModule] });

  describe('post selection', () => {
    it('picks the newest unread post within CEFR±1', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.B1);
      const older = await seedPost(suite.orm.em, {
        cefrLevel: CefrLevel.A2,
        publishedAt: DateTime.now().minus({ days: 2 }),
      });
      const newer = await seedPost(suite.orm.em, {
        cefrLevel: CefrLevel.B1,
        publishedAt: DateTime.now().minus({ days: 1 }),
      });
      // Outside CEFR±1 of a B1 learner — must not be picked over `newer`.
      await seedPost(suite.orm.em, {
        cefrLevel: CefrLevel.C2,
        publishedAt: DateTime.now(),
      });

      const candidate = await suite.query(
        new SelectDailyPlanCandidateQuery(user.id),
      );

      expect(candidate.postId).toBe(newer.id);
      expect(candidate.postId).not.toBe(older.id);
    });

    it('widens to any CEFR level when the narrow range has nothing unread', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.B1);
      const inRange = await seedPost(suite.orm.em, {
        cefrLevel: CefrLevel.B1,
        publishedAt: DateTime.now(),
      });
      await markRead(suite.orm.em, user.id, inRange.id);
      const outOfRange = await seedPost(suite.orm.em, {
        cefrLevel: CefrLevel.C2,
        publishedAt: DateTime.now().minus({ days: 1 }),
      });

      const candidate = await suite.query(
        new SelectDailyPlanCandidateQuery(user.id),
      );

      expect(candidate.postId).toBe(outOfRange.id);
    });

    it('falls back to an already-read post when nothing unread exists', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.B1);
      const onlyPost = await seedPost(suite.orm.em, {
        cefrLevel: CefrLevel.B1,
        publishedAt: DateTime.now(),
      });
      await markRead(suite.orm.em, user.id, onlyPost.id);

      const candidate = await suite.query(
        new SelectDailyPlanCandidateQuery(user.id),
      );

      expect(candidate.postId).toBe(onlyPost.id);
    });

    it('throws NoPostAvailableError when no post is published', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.B1);
      await seedPost(suite.orm.em, {
        cefrLevel: CefrLevel.B1,
        publishedAt: DateTime.now(),
        status: PostStatus.Pending,
      });

      await expect(
        suite.query(new SelectDailyPlanCandidateQuery(user.id)),
      ).rejects.toThrow(NoPostAvailableError);
    });
  });

  describe('grammar highlight selection', () => {
    async function seedPostWithSentences(
      em: EntityManager,
      cefrLevel: CefrLevel,
    ): Promise<Post> {
      return seedPost(em, { cefrLevel, publishedAt: DateTime.now() });
    }

    async function seedMatch(
      em: EntityManager,
      opts: {
        postId: string;
        unitIndex: number;
        position: number;
        grammarUsagePointId: string;
      },
    ): Promise<void> {
      const sentence = factories(em).sentence.makeOne({
        postId: opts.postId,
        postPartId: factories(em).postPart.makeOne({ postId: opts.postId }).id,
        unitIndex: opts.unitIndex,
        position: opts.position,
        rawText: 'Some sentence.',
        charStart: 0,
        charEnd: 14,
      });
      await em.flush();
      factories(em).grammarMatch.makeOne({
        sentenceId: sentence.id,
        grammarUsagePointId: opts.grammarUsagePointId,
        tokenStart: 0,
        tokenEnd: 1,
      });
      await em.flush();
    }

    it('skips a below-level point (auto-known) and picks the first genuinely new one', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A2);
      const post = await seedPostWithSentences(suite.orm.em, CefrLevel.B1);

      const belowLevel = makeGrammarUsagePoint(suite.factories, {
        cefrLevel: CefrLevel.A1,
        guideword: 'below level',
        canDoStatement: 'x',
      });
      const aboveLevel = makeGrammarUsagePoint(suite.factories, {
        cefrLevel: CefrLevel.B1,
        guideword: 'above level',
        canDoStatement: 'y',
      });
      await suite.orm.em.flush();

      await seedMatch(suite.orm.em, {
        postId: post.id,
        unitIndex: 0,
        position: 0,
        grammarUsagePointId: belowLevel.id,
      });
      await seedMatch(suite.orm.em, {
        postId: post.id,
        unitIndex: 0,
        position: 1,
        grammarUsagePointId: aboveLevel.id,
      });

      const candidate = await suite.query(
        new SelectDailyPlanCandidateQuery(user.id),
      );

      expect(candidate.grammarUsagePointId).toBe(aboveLevel.id);
    });

    it('returns null when every matched point is already known', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.B2);
      const post = await seedPostWithSentences(suite.orm.em, CefrLevel.B1);

      const belowLevel = makeGrammarUsagePoint(suite.factories, {
        cefrLevel: CefrLevel.A2,
        guideword: 'below level',
        canDoStatement: 'x',
      });
      await suite.orm.em.flush();

      await seedMatch(suite.orm.em, {
        postId: post.id,
        unitIndex: 0,
        position: 0,
        grammarUsagePointId: belowLevel.id,
      });

      const candidate = await suite.query(
        new SelectDailyPlanCandidateQuery(user.id),
      );

      expect(candidate.grammarUsagePointId).toBeNull();
    });

    it('skips a point with an active learning card', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A1);
      const post = await seedPostWithSentences(suite.orm.em, CefrLevel.C1);

      const withCard = makeGrammarUsagePoint(suite.factories, {
        cefrLevel: CefrLevel.C1,
        guideword: 'has a card',
        canDoStatement: 'x',
      });
      const withoutCard = makeGrammarUsagePoint(suite.factories, {
        cefrLevel: CefrLevel.C1,
        guideword: 'no card',
        canDoStatement: 'y',
      });
      await suite.orm.em.flush();

      await seedMatch(suite.orm.em, {
        postId: post.id,
        unitIndex: 0,
        position: 0,
        grammarUsagePointId: withCard.id,
      });
      await seedMatch(suite.orm.em, {
        postId: post.id,
        unitIndex: 0,
        position: 1,
        grammarUsagePointId: withoutCard.id,
      });

      suite.factories.learningCard.makeOne({
        userId: user.id,
        grammarUsagePointId: withCard.id,
        due: DateTime.now(),
        stability: 1,
        difficulty: 1,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: LearningCardState.Learning,
      });
      await suite.orm.em.flush();

      const candidate = await suite.query(
        new SelectDailyPlanCandidateQuery(user.id),
      );

      expect(candidate.grammarUsagePointId).toBe(withoutCard.id);
    });

    it('skips a point the learner has explicitly skipped', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A1);
      const post = await seedPostWithSentences(suite.orm.em, CefrLevel.C1);

      const skipped = makeGrammarUsagePoint(suite.factories, {
        cefrLevel: CefrLevel.C1,
        guideword: 'skipped',
        canDoStatement: 'x',
      });
      await suite.orm.em.flush();

      await seedMatch(suite.orm.em, {
        postId: post.id,
        unitIndex: 0,
        position: 0,
        grammarUsagePointId: skipped.id,
      });

      suite.factories.learningDisposition.makeOne({
        userId: user.id,
        grammarUsagePointId: skipped.id,
        disposition: Disposition.Skipped,
      });
      await suite.orm.em.flush();

      const candidate = await suite.query(
        new SelectDailyPlanCandidateQuery(user.id),
      );

      expect(candidate.grammarUsagePointId).toBeNull();
    });
  });
});
