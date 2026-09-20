import { Factory } from '@mikro-orm/seeder';
import { SentenceToken } from '../../src/modules/post/entities/sentence-token.entity.js';

// `sentenceId` has no default — pass the owning sentence's id. `position` is
// unique per sentence, so set it explicitly when a sentence has several tokens.
export class SentenceTokenFactory extends Factory<SentenceToken> {
  readonly model = SentenceToken;

  protected definition() {
    return {
      position: 0,
      text: 'text',
      charStart: 0,
      charEnd: 4,
      lemma: 'text',
      pos: 'NOUN',
      tag: 'NN',
      dep: 'ROOT',
      morph: {},
    };
  }
}
