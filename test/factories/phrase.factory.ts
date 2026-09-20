import { Factory } from '@mikro-orm/seeder';
import { Phrase } from '../../src/modules/post/entities/phrase.entity.js';
import { nextSeq } from './sequence.js';

export class PhraseFactory extends Factory<Phrase> {
  readonly model = Phrase;

  protected definition() {
    return { phraseText: `phrase ${nextSeq('phrase')}` };
  }
}
