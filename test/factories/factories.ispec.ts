import { createIntegrationSuite } from '../setup/int-suite.helper.js';

// Every factory's defaults must satisfy its table's NOT NULL / CHECK /
// UNIQUE constraints once the caller supplies the parent ids.
describe('entity factories', () => {
  const suite = createIntegrationSuite();

  it('persists the whole entity graph from factory defaults', async () => {
    const f = suite.factories;

    const user = await f.user.createOne();
    const post = await f.post.createOne();
    const category = await f.grammarCategory.createOne();
    const construction = await f.grammarConstruction.createOne({
      categoryId: category.id,
    });
    const usagePoint = await f.grammarUsagePoint.createOne({
      constructionId: construction.id,
    });
    const word = await f.word.createOne();
    const wordDefinition = await f.wordDefinition.createOne({
      wordId: word.id,
    });
    const phrase = await f.phrase.createOne();
    const part = await f.postPart.createOne({ postId: post.id });
    const sentence = await f.sentence.createOne({
      postId: post.id,
      postPartId: part.id,
    });
    await f.sentenceToken.createOne({ sentenceId: sentence.id });
    await f.grammarMatch.createOne({
      sentenceId: sentence.id,
      grammarUsagePointId: usagePoint.id,
    });
    await f.exercise.createOne({ postId: post.id });
    await f.postPipelineRun.createOne({ postId: post.id });
    await f.postPublication.createOne({ postId: post.id });
    await f.postRead.createOne({ userId: user.id, postId: post.id });
    await f.dailyPlan.createOne({ userId: user.id, postId: post.id });
    const card = await f.learningCard.createOne({
      userId: user.id,
      wordDefinitionId: wordDefinition.id,
    });
    await f.learningCard.createOne({ userId: user.id, phraseId: phrase.id });
    await f.learningDisposition.createOne({
      userId: user.id,
      grammarUsagePointId: usagePoint.id,
    });
    await f.reviewLog.createOne({ cardId: card.id });
    await f.userSkillProgress.createOne({
      userId: user.id,
      constructionId: construction.id,
    });
    await f.subscription.createOne({ userId: user.id });
    await f.streakFreeze.createOne({ userId: user.id });
    await f.accountDeletionRequest.createOne({ userId: user.id });
    await f.authSession.createOne({ userId: user.id });
    await f.authChallenge.createOne();
    await f.telegramUpdate.createOne();

    expect(post.status).toBe('published');
    expect(post.source.attributionText).toBe('Original content');
  });

  it('gives each unique-constrained default a fresh value', async () => {
    const users = await suite.factories.user.create(3);

    expect(new Set(users.map((u) => u.email)).size).toBe(3);
  });
});
