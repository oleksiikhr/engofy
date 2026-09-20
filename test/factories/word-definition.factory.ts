import { Factory } from '@mikro-orm/seeder';
import { WordDefinition } from '../../src/modules/post/entities/word-definition.entity.js';
import { PartOfSpeech } from '../../src/modules/post/enums/part-of-speech.enum.js';

// `wordId` has no default — pass the word's id. `pos` is unique per word, so
// set it explicitly when a word has several definitions.
export class WordDefinitionFactory extends Factory<WordDefinition> {
  readonly model = WordDefinition;

  protected definition() {
    return { pos: PartOfSpeech.Noun };
  }
}
