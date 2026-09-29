import { Module } from '@nestjs/common';
import { WordsCommand } from './words.command.js';
import { WordsImportFrequencyCommand } from './words-import-frequency.command.js';
import { WordsImportLexiconContentCommand } from './words-import-lexicon-content.command.js';

@Module({
  providers: [
    WordsCommand,
    WordsImportFrequencyCommand,
    WordsImportLexiconContentCommand,
  ],
})
export class WordsCliModule {}
