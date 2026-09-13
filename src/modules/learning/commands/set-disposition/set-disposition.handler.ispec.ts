import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PartOfSpeech } from '../../../post/enums/part-of-speech.enum.js';
import { LearningDisposition } from '../../entities/learning-disposition.entity.js';
import { Disposition } from '../../enums/disposition.enum.js';
import { InvalidCardTargetError } from '../../errors/invalid-card-target.error.js';
import { LearningModule } from '../../learning.module.js';
import { SetDispositionCommand } from './set-disposition.command.js';

describe('SetDispositionHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  async function seedWordDefinition(): Promise<string> {
    const word = suite.orm.em.create(Word, { lemma: `w-${uuidv7()}` });
    const definition = suite.orm.em.create(WordDefinition, {
      wordId: word.id,
      pos: PartOfSpeech.Noun,
      cefrLevel: CefrLevel.A1,
    });
    await suite.orm.em.flush();
    return definition.id;
  }

  it('creates a disposition row for a word definition target', async () => {
    const userId = uuidv7();
    const wordDefinitionId = await seedWordDefinition();

    const view = await suite.command(
      new SetDispositionCommand(
        userId,
        { wordDefinitionId },
        Disposition.Known,
      ),
    );

    expect(view.disposition).toBe(Disposition.Known);
    const stored = await suite.orm.em.findOneOrFail(LearningDisposition, {
      id: view.id,
    });
    expect(stored.wordDefinitionId).toBe(wordDefinitionId);
    expect(stored.phraseId).toBeNull();
  });

  it('overwrites the stored value on a second call for the same target', async () => {
    const userId = uuidv7();
    const phrase = suite.orm.em.create(Phrase, {
      phraseText: `p-${uuidv7()}`,
    });
    await suite.orm.em.flush();

    await suite.command(
      new SetDispositionCommand(
        userId,
        { phraseId: phrase.id },
        Disposition.Skipped,
      ),
    );
    const second = await suite.command(
      new SetDispositionCommand(
        userId,
        { phraseId: phrase.id },
        Disposition.Known,
      ),
    );

    expect(second.disposition).toBe(Disposition.Known);
    expect(await suite.orm.em.count(LearningDisposition, { userId })).toBe(1);
  });

  it('rejects a target id that does not exist', async () => {
    await expect(
      suite.command(
        new SetDispositionCommand(
          uuidv7(),
          { grammarUsagePointId: uuidv7() },
          Disposition.Known,
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidCardTargetError);
  });

  it('rejects a target with more than one id set', async () => {
    const point = suite.orm.em.create(GrammarUsagePoint, {
      constructionId: uuidv7(),
      cefrLevel: CefrLevel.B1,
      guideword: 'USE: past perfect',
      canDoStatement: 'Can talk about an earlier past.',
    });
    await suite.orm.em.flush();

    await expect(
      suite.command(
        new SetDispositionCommand(
          uuidv7(),
          { phraseId: uuidv7(), grammarUsagePointId: point.id },
          Disposition.Known,
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidCardTargetError);
  });
});
