import { Factory } from '@mikro-orm/seeder';
import { Sentence } from '../../src/modules/post/entities/sentence.entity.js';

// `postId` and `postPartId` have no default — pass the parents' ids.
// `(postPartId, unitIndex, position)` is unique, so set `position` explicitly
// when a part has several sentences.
export class SentenceFactory extends Factory<Sentence> {
  readonly model = Sentence;

  protected definition() {
    return { position: 0, rawText: 'Some text.', charStart: 0, charEnd: 10 };
  }
}
