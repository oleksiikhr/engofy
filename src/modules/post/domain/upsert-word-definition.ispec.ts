import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { Word } from '../entities/word.entity.js';
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { PostModule } from '../post.module.js';
import { upsertWordDefinition } from './upsert-word-definition.js';
import { loadWordFrequencyRanks } from './word-frequency.js';

describe('upsertWordDefinition', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('ranks a new lemma from the bundled frequency list', async () => {
    const ranks = await loadWordFrequencyRanks();
    const { wordId } = await upsertWordDefinition(
      suite.orm.em,
      'The',
      PartOfSpeech.Noun,
    );

    suite.orm.em.clear();
    const word = await suite.orm.em.findOneOrFail(Word, { id: wordId });
    expect(word.frequencyRank).toBe(ranks.get('the'));
    expect(word.frequencyRank).toBeGreaterThan(0);
  });

  it('leaves the rank null for a lemma outside the list', async () => {
    const { wordId } = await upsertWordDefinition(
      suite.orm.em,
      'zzqxunlisted',
      PartOfSpeech.Noun,
    );

    suite.orm.em.clear();
    const word = await suite.orm.em.findOneOrFail(Word, { id: wordId });
    expect(word.frequencyRank).toBeNull();
  });

  it('fills a missing rank on an existing word but never overwrites one', async () => {
    const unranked = await suite.factories.word.createOne({
      lemma: 'people',
      frequencyRank: null,
    });
    const ranked = await suite.factories.word.createOne({
      lemma: 'water',
      frequencyRank: 999999,
    });

    await upsertWordDefinition(suite.orm.em, 'people', PartOfSpeech.Noun);
    await upsertWordDefinition(suite.orm.em, 'water', PartOfSpeech.Noun);

    suite.orm.em.clear();
    const ranks = await loadWordFrequencyRanks();
    const a = await suite.orm.em.findOneOrFail(Word, { id: unranked.id });
    const b = await suite.orm.em.findOneOrFail(Word, { id: ranked.id });
    expect(a.frequencyRank).toBe(ranks.get('people'));
    expect(b.frequencyRank).toBe(999999);
  });
});
