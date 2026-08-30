import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { Phrase } from '../entities/phrase.entity.js';
import { PhraseType } from '../enums/phrase-type.enum.js';
import { PostModule } from '../post.module.js';
import { upsertPhraseId } from './upsert-phrase-id.js';

describe('upsertPhraseId', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('inserts a new phrase and returns its id', async () => {
    const id = await upsertPhraseId(
      suite.orm.em,
      'kick the bucket',
      PhraseType.Idiom,
    );

    const row = await suite.orm.em.findOneOrFail(Phrase, { id });
    expect(row.phraseText).toBe('kick the bucket');
    expect(row.type).toBe(PhraseType.Idiom);
  });

  it('returns the existing id on a case-insensitive text match', async () => {
    const first = await upsertPhraseId(
      suite.orm.em,
      'break the ice',
      PhraseType.Idiom,
    );
    const second = await upsertPhraseId(
      suite.orm.em,
      'BREAK THE ICE',
      PhraseType.Collocation,
    );

    expect(second).toBe(first);
  });

  it('leaves the original type untouched on conflict', async () => {
    const id = await upsertPhraseId(
      suite.orm.em,
      'strong coffee',
      PhraseType.Collocation,
    );
    await upsertPhraseId(suite.orm.em, 'strong coffee', PhraseType.Idiom);

    suite.orm.em.clear();
    const row = await suite.orm.em.findOneOrFail(Phrase, { id });
    expect(row.type).toBe(PhraseType.Collocation);
  });
});
