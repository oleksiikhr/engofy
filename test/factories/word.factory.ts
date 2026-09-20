import { Factory } from '@mikro-orm/seeder';
import { Word } from '../../src/modules/post/entities/word.entity.js';
import { nextSeq } from './sequence.js';

export class WordFactory extends Factory<Word> {
  readonly model = Word;

  protected definition() {
    return { lemma: `word${nextSeq('word')}` };
  }
}
