import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { factories } from '../../../../../test/factories/factories.js';
import {
  makeGrammarUsagePoint,
  makeWordDefinition,
} from '../../../../../test/helpers/reference-data.helper.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { Subscription } from '../../../billing/entities/subscription.entity.js';
import { SubscriptionPlan } from '../../../billing/enums/subscription-plan.enum.js';
import { DailyPlan } from '../../../home/entities/daily-plan.entity.js';
import { LearningCard } from '../../../learning/entities/learning-card.entity.js';
import { LearningDisposition } from '../../../learning/entities/learning-disposition.entity.js';
import { ReviewLog } from '../../../learning/entities/review-log.entity.js';
import { UserSkillProgress } from '../../../learning/entities/user-skill-progress.entity.js';
import { Disposition } from '../../../learning/enums/disposition.enum.js';
import { ReviewRating } from '../../../learning/enums/review-rating.enum.js';
import { PostRead } from '../../../post/entities/post-read.entity.js';
import { AuthModule } from '../../auth.module.js';
import { AccountDeletionRequest } from '../../entities/account-deletion-request.entity.js';
import { AuthChallenge } from '../../entities/auth-challenge.entity.js';
import { AuthSession } from '../../entities/auth-session.entity.js';
import { User } from '../../entities/user.entity.js';
import { DeleteExpiredAccountsService } from './delete-expired-accounts.service.js';

describe('DeleteExpiredAccountsService', () => {
  let service: DeleteExpiredAccountsService;

  const suite = createIntegrationSuite({ imports: [AuthModule] });

  beforeAll(() => {
    service = suite.moduleRef.get(DeleteExpiredAccountsService, {
      strict: false,
    });
  });

  // Seeds a user with one row in every user-owned table plus a pending OTP.
  const seedUser = async (opts: {
    requestedDaysAgo?: number;
    cancelled?: boolean;
  }) => {
    const { em } = suite.orm;
    const user = factories(em).user.makeOne({
      email: `user-${randomUUID()}@example.com`,
    });
    const userId = user.id;
    const post = await suite.factories.post.createOne();
    const card = factories(em).learningCard.makeOne({
      userId,
      wordDefinitionId: makeWordDefinition(factories(em)).id,
      due: DateTime.now(),
      stability: 1,
      difficulty: 1,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
    });
    factories(em).reviewLog.makeOne({
      cardId: card.id,
      rating: ReviewRating.Good,
      reviewedAt: DateTime.now(),
      elapsedDays: 0,
      scheduledDays: 1,
    });
    factories(em).learningDisposition.makeOne({
      userId,
      phraseId: factories(em).phrase.makeOne().id,
      disposition: Disposition.Known,
    });
    factories(em).userSkillProgress.makeOne({
      userId,
      constructionId: makeGrammarUsagePoint(factories(em)).constructionId,
    });
    factories(em).postRead.makeOne({
      userId,
      postId: post.id,
      readAt: DateTime.now(),
    });
    factories(em).dailyPlan.makeOne({
      userId,
      planDate: DateTime.now().startOf('day'),
      postId: post.id,
    });
    factories(em).subscription.makeOne({
      userId,
      plan: SubscriptionPlan.Premium,
      currentPeriodEnd: DateTime.now().plus({ days: 5 }),
    });
    factories(em).authSession.makeOne({
      userId,
      tokenHash: randomUUID(),
      expiresAt: DateTime.now().plus({ days: 1 }),
    });
    factories(em).authChallenge.makeOne({
      email: user.email,
      otpHash: 'hash',
      expiresAt: DateTime.now().plus({ minutes: 5 }),
    });

    if (opts.requestedDaysAgo !== undefined) {
      factories(em).accountDeletionRequest.makeOne({
        userId,
        cancelTokenHash: randomUUID(),
        requestedAt: DateTime.now().minus({ days: opts.requestedDaysAgo }),
        cancelledAt: opts.cancelled ? DateTime.now() : null,
      });
    }

    await em.flush();
    em.clear();

    return { userId, email: user.email };
  };

  const countRows = async (userId: string, email: string) => {
    const { em } = suite.orm;
    const cards = await em.find(LearningCard, { userId });

    return {
      user: await em.count(User, { id: userId }),
      cards: cards.length,
      reviewLogs: await em.count(ReviewLog, {
        cardId: { $in: cards.map((c) => c.id) },
      }),
      dispositions: await em.count(LearningDisposition, { userId }),
      skillProgress: await em.count(UserSkillProgress, { userId }),
      postReads: await em.count(PostRead, { userId }),
      dailyPlans: await em.count(DailyPlan, { userId }),
      subscriptions: await em.count(Subscription, { userId }),
      sessions: await em.count(AuthSession, { userId }),
      challenges: await em.count(AuthChallenge, { email }),
      requests: await em.count(AccountDeletionRequest, { userId }),
    };
  };

  it('deletes an account past the grace period with all of its data', async () => {
    const expired = await seedUser({ requestedDaysAgo: 31 });

    await service.run();
    suite.orm.em.clear();

    expect(await countRows(expired.userId, expired.email)).toEqual({
      user: 0,
      cards: 0,
      reviewLogs: 0,
      dispositions: 0,
      skillProgress: 0,
      postReads: 0,
      dailyPlans: 0,
      subscriptions: 0,
      sessions: 0,
      challenges: 0,
      requests: 0,
    });
  });

  it('keeps accounts still in the grace period, cancelled, or never requested', async () => {
    const pending = await seedUser({ requestedDaysAgo: 10 });
    const cancelled = await seedUser({ requestedDaysAgo: 40, cancelled: true });
    const untouched = await seedUser({});
    const expired = await seedUser({ requestedDaysAgo: 31 });

    await service.run();
    suite.orm.em.clear();

    const kept = {
      user: 1,
      cards: 1,
      reviewLogs: 1,
      dispositions: 1,
      skillProgress: 1,
      postReads: 1,
      dailyPlans: 1,
      subscriptions: 1,
      sessions: 1,
      challenges: 1,
    };
    expect(await countRows(pending.userId, pending.email)).toEqual({
      ...kept,
      requests: 1,
    });
    expect(await countRows(cancelled.userId, cancelled.email)).toEqual({
      ...kept,
      requests: 1,
    });
    expect(await countRows(untouched.userId, untouched.email)).toEqual({
      ...kept,
      requests: 0,
    });
    expect((await countRows(expired.userId, expired.email)).user).toBe(0);
  });

  it('is a no-op when nothing is due', async () => {
    await expect(service.run()).resolves.toBeUndefined();
  });

  it('leaves only auth_sessions without a cascading FK on user_id', async () => {
    const rows = await suite.orm.em
      .getConnection()
      .execute<{ table_name: string }[]>(
        `select c.table_name from information_schema.columns c
         where c.table_schema = current_schema() and c.column_name = 'user_id'
           and not exists (
             select 1 from pg_constraint con
             where con.contype = 'f' and con.confdeltype = 'c'
               and con.confrelid = to_regclass('users')
               and con.conrelid = to_regclass(quote_ident(c.table_name)))`,
      );

    expect(rows.map((r) => r.table_name)).toEqual(['auth_sessions']);
  });
});
