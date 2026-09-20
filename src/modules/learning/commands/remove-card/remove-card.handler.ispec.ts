import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PartOfSpeech } from '../../../post/enums/part-of-speech.enum.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningDisposition } from '../../entities/learning-disposition.entity.js';
import { Disposition } from '../../enums/disposition.enum.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { CardNotFoundError } from '../../errors/card-not-found.error.js';
import { LearningModule } from '../../learning.module.js';
import { RemoveCardCommand } from './remove-card.command.js';

describe('RemoveCardHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  function makeCard(
    overrides: Partial<LearningCard> & { userId: string },
  ): LearningCard {
    return suite.factories.learningCard.makeOne({
      due: DateTime.now(),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: LearningCardState.New,
      ...overrides,
    });
  }

  it('physically deletes a never-reviewed card', async () => {
    const userId = uuidv7();
    const word = suite.factories.word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = suite.factories.wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    const card = makeCard({ userId, wordDefinitionId: definition.id });
    await suite.orm.em.flush();

    await suite.command(new RemoveCardCommand(userId, card.id));

    expect(
      await suite.orm.em.findOne(LearningCard, { id: card.id }),
    ).toBeNull();
  });

  it('archives a reviewed phrase card and records a Known disposition', async () => {
    const userId = uuidv7();
    const phrase = suite.factories.phrase.makeOne({
      phraseText: `p-${uuidv7()}`,
    });
    const card = makeCard({
      userId,
      phraseId: phrase.id,
      reps: 3,
      state: LearningCardState.Review,
    });
    await suite.orm.em.flush();

    await suite.command(new RemoveCardCommand(userId, card.id));

    const stored = await suite.orm.em.findOneOrFail(LearningCard, {
      id: card.id,
    });
    expect(stored.archivedAt).not.toBeNull();

    const disposition = await suite.orm.em.findOneOrFail(LearningDisposition, {
      userId,
      phraseId: phrase.id,
    });
    expect(disposition.disposition).toBe(Disposition.Known);
  });

  it('archives a reviewed word card and records a Known disposition on that sense', async () => {
    const userId = uuidv7();
    const word = suite.factories.word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = suite.factories.wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    const card = makeCard({
      userId,
      wordDefinitionId: definition.id,
      reps: 2,
      state: LearningCardState.Learning,
    });
    await suite.orm.em.flush();

    await suite.command(new RemoveCardCommand(userId, card.id));

    const stored = await suite.orm.em.findOneOrFail(LearningCard, {
      id: card.id,
    });
    expect(stored.archivedAt).not.toBeNull();

    const disposition = await suite.orm.em.findOneOrFail(LearningDisposition, {
      userId,
      wordDefinitionId: definition.id,
    });
    expect(disposition.disposition).toBe(Disposition.Known);
  });

  it('overwrites an existing disposition rather than duplicating it', async () => {
    const userId = uuidv7();
    const phrase = suite.factories.phrase.makeOne({
      phraseText: `p-${uuidv7()}`,
    });
    suite.factories.learningDisposition.makeOne({
      userId,
      phraseId: phrase.id,
      disposition: Disposition.Skipped,
    });
    const card = makeCard({
      userId,
      phraseId: phrase.id,
      reps: 1,
      state: LearningCardState.Learning,
    });
    await suite.orm.em.flush();

    await suite.command(new RemoveCardCommand(userId, card.id));

    expect(await suite.orm.em.count(LearningDisposition, { userId })).toBe(1);
    const disposition = await suite.orm.em.findOneOrFail(LearningDisposition, {
      userId,
      phraseId: phrase.id,
    });
    expect(disposition.disposition).toBe(Disposition.Known);
  });

  it('rejects a card id that does not belong to the user', async () => {
    const word = suite.factories.word.makeOne({ lemma: `w-${uuidv7()}` });
    const definition = suite.factories.wordDefinition.makeOne({
      wordId: word.id,
      pos: PartOfSpeech.Noun,
    });
    const card = makeCard({
      userId: uuidv7(),
      wordDefinitionId: definition.id,
    });
    await suite.orm.em.flush();

    await expect(
      suite.command(new RemoveCardCommand(uuidv7(), card.id)),
    ).rejects.toBeInstanceOf(CardNotFoundError);
  });

  it('rejects an unknown card id', async () => {
    await expect(
      suite.command(new RemoveCardCommand(uuidv7(), uuidv7())),
    ).rejects.toBeInstanceOf(CardNotFoundError);
  });
});
