import { Module } from '@nestjs/common';
import { WordsCommand } from './words.command.js';
import { WordsImportFrequencyCommand } from './words-import-frequency.command.js';
import { WordsImportLexiconContentCommand } from './words-import-lexicon-content.command.js';
import { WordsImportPhraseContentCommand } from './words-import-phrase-content.command.js';

@Module({
  providers: [
    WordsCommand,
    WordsImportFrequencyCommand,
    WordsImportLexiconContentCommand,
    WordsImportPhraseContentCommand,
  ],
})
export class WordsCliModule {}
