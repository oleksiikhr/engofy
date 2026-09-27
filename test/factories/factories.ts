import type { EntityManager } from '@mikro-orm/core';
import { AccountDeletionRequestFactory } from './account-deletion-request.factory.js';
import { AuthChallengeFactory } from './auth-challenge.factory.js';
import { AuthSessionFactory } from './auth-session.factory.js';
import { DailyPlanFactory } from './daily-plan.factory.js';
import { ExerciseFactory } from './exercise.factory.js';
import { GrammarCategoryFactory } from './grammar-category.factory.js';
import { GrammarConstructionFactory } from './grammar-construction.factory.js';
import { GrammarMatchFactory } from './grammar-match.factory.js';
import { GrammarUsagePointFactory } from './grammar-usage-point.factory.js';
import { GrammarUsagePointExerciseFactory } from './grammar-usage-point-exercise.factory.js';
import { LearningCardFactory } from './learning-card.factory.js';
import { LearningDispositionFactory } from './learning-disposition.factory.js';
import { PhraseFactory } from './phrase.factory.js';
import { PostFactory } from './post.factory.js';
import { PostPartFactory } from './post-part.factory.js';
import { PostPipelineRunFactory } from './post-pipeline-run.factory.js';
import { PostPublicationFactory } from './post-publication.factory.js';
import { PostReadFactory } from './post-read.factory.js';
import { ReviewLogFactory } from './review-log.factory.js';
import { SentenceFactory } from './sentence.factory.js';
import { SentenceTokenFactory } from './sentence-token.factory.js';
import { StreakFreezeFactory } from './streak-freeze.factory.js';
import { SubscriptionFactory } from './subscription.factory.js';
import { TelegramUpdateFactory } from './telegram-update.factory.js';
import { UserFactory } from './user.factory.js';
import { UserSkillProgressFactory } from './user-skill-progress.factory.js';
import { WordFactory } from './word.factory.js';
import { WordDefinitionFactory } from './word-definition.factory.js';

// One factory per entity, bound to `em`. Tests reach it as `suite.factories`.
export function factories(em: EntityManager) {
  return {
    accountDeletionRequest: new AccountDeletionRequestFactory(em),
    authChallenge: new AuthChallengeFactory(em),
    authSession: new AuthSessionFactory(em),
    dailyPlan: new DailyPlanFactory(em),
    exercise: new ExerciseFactory(em),
    grammarCategory: new GrammarCategoryFactory(em),
    grammarConstruction: new GrammarConstructionFactory(em),
    grammarMatch: new GrammarMatchFactory(em),
    grammarUsagePoint: new GrammarUsagePointFactory(em),
    grammarUsagePointExercise: new GrammarUsagePointExerciseFactory(em),
    learningCard: new LearningCardFactory(em),
    learningDisposition: new LearningDispositionFactory(em),
    phrase: new PhraseFactory(em),
    post: new PostFactory(em),
    postPart: new PostPartFactory(em),
    postPipelineRun: new PostPipelineRunFactory(em),
    postPublication: new PostPublicationFactory(em),
    postRead: new PostReadFactory(em),
    reviewLog: new ReviewLogFactory(em),
    sentence: new SentenceFactory(em),
    sentenceToken: new SentenceTokenFactory(em),
    streakFreeze: new StreakFreezeFactory(em),
    subscription: new SubscriptionFactory(em),
    telegramUpdate: new TelegramUpdateFactory(em),
    user: new UserFactory(em),
    userSkillProgress: new UserSkillProgressFactory(em),
    word: new WordFactory(em),
    wordDefinition: new WordDefinitionFactory(em),
  };
}

export type Factories = ReturnType<typeof factories>;
